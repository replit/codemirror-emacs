import { BlockCursorPlugin, hideNativeSelection } from "./block-cursor"
import { StateField, StateEffect, ChangeDesc, EditorSelection, Extension, MapMode } from "@codemirror/state"
import { showPanel, EditorView, ViewPlugin, PluginValue, ViewUpdate, keymap } from "@codemirror/view"
import * as commands from "@codemirror/commands"
import { startCompletion } from "@codemirror/autocomplete"
import { openSearchPanel } from "@codemirror/search"

const emacsStyle = EditorView.theme({
  ".cm-emacsMode .cm-cursorLayer:not(.cm-vimCursorLayer)": {
    display: "none",
  },
  ".cm-vim-panel": {
    padding: "5px 10px",
    backgroundColor: "#fffa8f",
    fontFamily: "monospace",
  },
  ".cm-vim-panel input": {
    border: "none",
    outline: "none",
    backgroundColor: "#fffa8f",
  },
}) 

const emacsPlugin = ViewPlugin.fromClass(class implements PluginValue {
   public view: EditorView;
  public status = ""
  public em: EmacsHandler
  blockCursor: BlockCursorPlugin
  constructor(view: EditorView) {
    this.view = view
    this.em = new EmacsHandler(view);

    this.blockCursor = new BlockCursorPlugin(view)
    this.view.scrollDOM.classList.add("cm-emacsMode")

    /*this.em.on("dialog", () => {
      view.dispatch({
        effects: showEmacsPanel.of(!!this.cm.state.dialog)
      })
    });*/

  }

  update(update: ViewUpdate) {
    if (update.docChanged) {      
      this.em.$emacsMark = null
      this.em.updateMarksOnChange(update.changes)
    }
    /*if (update.selectionSet) {
      this.em.onSelectionChange()
    } 
    if (update.viewportChanged) {
      // scroll
    }
    if (this.em.curOp && !this.em.curOp.isVimOp) {
      this.em.onBeforeEndOperation();
    }/**/

    this.blockCursor.update(update);
  }

  destroy() {
    this.view.scrollDOM.classList.remove("cm-emacsMode")
    this.blockCursor.destroy();
  }
}, {
  eventHandlers: {
    mousedown: function() {
      this.em.$emacsMark = null
    }
  },
  provide: plugin => {
    return keymap.of([
      {
        any: function(view, e) {
          return !!view.plugin(plugin)?.em.handleKeyboard(e)
        }
      }
    ])
  }
})




const showVimPanel = StateEffect.define<boolean>()

const vimPanelState = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (let e of tr.effects) if (e.is(showVimPanel)) value = e.value
    return value
  },
  provide: f => {
    return showPanel.from(f, on => on ? createVimPanel : null)
  }
})

function createVimPanel(view: EditorView) {
  let dom = document.createElement("div")
  dom.className = "cm-vim-panel"
  return { top: false, dom }
}

export function emacs(options: {} = {}): Extension {
  return [
    emacsStyle,
    emacsPlugin,
    hideNativeSelection,
    vimPanelState
  ]
}

type EmacsMark = number[]|null|undefined;

var specialKey: Record<string, string> = {
  Return: 'Return', Escape: 'Esc', Insert: 'Ins',
  ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down',
  Enter: 'Return', Divide: '/', Slash: '/', Multiply: '*',
  Subtract: '-', Minus: "-", Equal: '=',
};
var ignoredKeys: any = { Shift: 1, Alt: 1, Command: 1, Control: 1, CapsLock: 1 };

const commandKeyBinding: Record<string, any> = {}
class EmacsHandler {
  static bindKey(keyGroup: string, command: any) {
    keyGroup.split("|").forEach(function (binding) {
      let chain = "";
      let parts = binding.split(/\s+/);
      parts.forEach(function (keyGroup, index) {
        let modifiers = keyGroup.split(/-(?=.)/)
        let key = modifiers.pop()
        if (modifiers.length) {
          chain += modifiers.sort().join("-") + "-"
        }
        chain += key
        if (index === parts.length - 1) {
          commandKeyBinding[chain] = command;
        } else {
          commandKeyBinding[chain] = "null"
          chain += " ";
        }
      });
    })
  }
  static getKey(e: KeyboardEvent): string[] {
    var code = e.code;
    var key = e.key;
    if (ignoredKeys[key]) return ['', '', ''];
    if (code.length > 1) {
      if (code[0] == "N") code = code.replace(/^Numpad/, "");
      if (code[0] == "K") code = code.replace(/^Key/, "");
    }
    code = specialKey[code] || code;
    if (code.length == 1) code = code.toLowerCase();

    var modifier = '';
    if (e.ctrlKey) { modifier += 'C-'; }
    if (e.metaKey) { modifier += 'CMD-'; }
    if (e.altKey) { modifier += 'M-'; }
    if (e.shiftKey) { modifier += 'S-'; }

    return [code, modifier, key];
  }


  static commands: Record<string, any> = {}
  static addCommands(commands: any) {
    Object.keys(commands).forEach(function (name) {
      var command = commands[name]
      if (typeof command == "function") {
        command = { exec: command }
      }
      EmacsHandler.commands[name] = command;
    })
  }
  static execCommand(command: any, handler: EmacsHandler, args: any, count: number = 1) {
    var commandResult = undefined;
    if (typeof command === "function") {
      for (var i = 0; i < count; i++) command(handler.view);
    } else if (command === "null") {
      // waith for next key in the chain
    } else if (command.exec) {
      if (count > 1 && command.handlesCount) {
        if (!args) args = {};
        if (typeof args === 'object') args.count = count;
        count = 1
      }
      for (var i = 0; i < count; i++) commandResult = command.exec(handler, args || {})
    } else {
      throw new Error("missformed command")
    }
    return commandResult;
  };


  handleKeyboard(e: KeyboardEvent) {
    var keyData = EmacsHandler.getKey(e)
    var result = this.findCommand(keyData)
    if (result && result.command) {
      var commandResult = EmacsHandler.execCommand(result.command, this, result.args, result.count)
      if (commandResult === false)
        return;
    }
    return result
  }

  constructor(readonly view: EditorView) {

  }

  // commands
  $data: { count?: number | null, keyChain: string, lastCommand: string | null } = {
    count: 0,
    keyChain: "",
    lastCommand: ""
  }
  findCommand([key, modifier, text]: string[]) {
    // if keyCode == -1 a non-printable key was pressed, such as just
    // control. Handling those is currently not supported in this handler
    if (!key) return undefined;

    var editor = this;
    var data = this.$data;
    // editor._signal("changeStatus");
    // insertstring data.count times
    if (!modifier && key.length == 1) {
      editor.pushEmacsMark();
      if (data.count) {
        var str = new Array(data.count + 1).join(text);
        data.count = null;
        return { command: "insertstring", args: str };
      }
    }

    // CTRL + number / universalArgument for setting data.count
    if (modifier == "C-" || data.count) {
      var count = parseInt(key[key.length - 1]);
      if (typeof count === 'number' && !isNaN(count)) {
        data.count = Math.max(data.count || 0, 0);
        data.count = 10 * data.count + count;
        return { command: "null" };
      }
    }

    // this.commandKeyBinding maps key specs like "c-p" (for CTRL + P) to
    // command objects, for lookup key needs to include the modifier
    if (modifier) key = modifier + key;

    // Key combos like CTRL+X H build up the data.keyChain
    if (data.keyChain) key = data.keyChain += " " + key;

    // Key combo prefixes get stored as "null" (String!) in this
    // this.commandKeyBinding. When encountered no command is invoked but we
    // buld up data.keyChain
    var command = commandKeyBinding[key];
    data.keyChain = command == "null" ? key : "";

    // there really is no command
    if (!command) return undefined;

    // we pass b/c of key combo or universalArgument
    if (command === "null") return { command: "null" };

    if (command === "universalArgument") {
      // if no number pressed emacs repeats action 4 times.
      // minus sign is needed to allow next keypress to replace it
      data.count = -4;
      return { command: "null" };
    }

    // lookup command
    // TODO extract special handling of markmode
    // TODO special case command.command is really unnecessary, remove
    var args;
    if (typeof command !== "string") {
      args = command.args;
      if (command.command) command = command.command;
    }

    if (command === "insertstring" ||
      command === commands.splitLine ||
      command === commands.toggleComment) {
      editor.pushEmacsMark();
    }
    if (typeof command === "string") {
      command = EmacsHandler.commands[command];
      if (!command) return undefined;
    }

    if (!command.readOnly && !command.isYank)
      data.lastCommand = null;

    var count = data.count || 1
    if (data.count) data.count = 0;

    return { command, args, count };
  }

  showCommandLine(text: string) {
    console.error("TODO")
  }

  // mark
  $emacsMarkRing = [] as EmacsMark[];
  $emacsMark?: EmacsMark = null;

  updateMarksOnChange(change: ChangeDesc) {
    if (this.$emacsMark) {
      this.$emacsMark = this.updateMark(this.$emacsMark, change);
    }
    this.$emacsMarkRing = this.$emacsMarkRing.map(x=> {
      return this.updateMark(x, change);
    }).filter(Boolean);
  }
  
  updateMark(mark: EmacsMark, change: ChangeDesc) {
    if (!mark) return;
    var updated = mark.map(function(x) {
      return change.mapPos(x, 1, MapMode.TrackDel)
    }).filter(x => x!= null);
    return updated.length == 0 ? null : (updated as number[])
  }

  emacsMark() {
    return this.$emacsMark;
  };

  setEmacsMark(p?: EmacsMark) {
    // to deactivate pass in a falsy value
    this.$emacsMark = p;
  };

  pushEmacsMark(p?: EmacsMark, activate?: boolean) {
    var prevMark = this.$emacsMark;
    if (prevMark)
      this.$emacsMarkRing.push(prevMark);
    if (!p || activate) this.setEmacsMark(p);
    else this.$emacsMarkRing.push(p);
  };

  popEmacsMark() {
    var mark = this.emacsMark();
    if (mark) { this.setEmacsMark(null); return mark; }
    return this.$emacsMarkRing.pop();
  };

  getLastEmacsMark() {
    return this.$emacsMark || this.$emacsMarkRing.slice(-1)[0];
  };

  getCopyText() {
    var state = this.view.state
    return state.selection.ranges.map(r => state.sliceDoc(r.from, r.to)).join("\n")
  }

  clearSelection() {
    var view = this.view
    var selection = view.state.selection
    var isEmpty = !selection.ranges.some(r => r.from != r.to)
    if (isEmpty) return false
    var newRanges = selection.ranges.map(x => {
      return EditorSelection.range(x.head, x.head)
    })
    view.dispatch({
      selection: EditorSelection.create(newRanges, selection.mainIndex)
    })
    return true
  }
  onPaste(text:string) {
    var view = this.view
    var selection = view.state.selection
    var linesToInsert: string[];
    if (selection.ranges.length > 1) {
      var lines = text.split("\n")
      if (lines.length == selection.ranges.length) {
        linesToInsert = lines;
      }
    }

    var i = 0
    var specs = view.state.changeByRange((range) => {
      var toInsert = linesToInsert ? linesToInsert[i] : text
      i++;

      return { 
        changes: { from: range.from, to: range.to, insert: toInsert },
        range: EditorSelection.cursor(range.from + toInsert.length)
      }
    })
    view.dispatch(specs)
  }
}

export const emacsKeys: Record<string, any> = {
  // movement
  "Up|C-p": { command: "goOrSelect", args: [commands.cursorLineUp, commands.selectLineUp] },
  "Down|C-n": { command: "goOrSelect", args: [commands.cursorLineDown, commands.selectLineDown] },
  "Left|C-b": { command: "goOrSelect", args: [commands.cursorCharBackward, commands.selectCharBackward] },
  "Right|C-f": { command: "goOrSelect", args: [commands.cursorCharForward, commands.selectCharForward] },
  "C-Left|M-b": { command: "goOrSelect", args: [commands.cursorGroupLeft, commands.selectGroupLeft] },
  "C-Right|M-f": { command: "goOrSelect", args: [commands.cursorGroupRight, commands.selectGroupRight] },
  "Home|C-a": { command: "goOrSelect", args: [commands.cursorLineStart, commands.selectLineStart] },
  "End|C-e": { command: "goOrSelect", args: [commands.cursorLineEnd, commands.selectLineEnd] },
  "C-Home|S-M-,": { command: "goOrSelect", args: [commands.cursorDocStart, commands.selectDocStart] },
  "C-End|S-M-.": { command: "goOrSelect", args: [commands.cursorDocEnd, commands.selectDocEnd] },

  // selection
  "S-Up|S-C-p": commands.selectLineUp,
  "S-Down|S-C-n": commands.selectLineDown,
  "S-Left|S-C-b": commands.selectCharBackward,
  "S-Right|S-C-f": commands.selectCharForward,
  "S-C-Left|S-M-b": commands.selectGroupBackward,
  "S-C-Right|S-M-f": commands.selectGroupForward,
  "S-Home|S-C-a": commands.selectLineStart,
  "S-End|S-C-e": commands.selectLineEnd,
  "S-C-Home": commands.selectDocStart,
  "S-C-End": commands.selectDocEnd,

  "C-l": "recenterTopBottom",
  "M-s": "centerSelection",
  "M-g": "gotoline",
  "C-x C-p|C-x h": commands.selectAll,

  "PageDown|C-v|C-Down": { command: "goOrSelect", args: [commands.cursorPageDown, commands.selectPageDown] },
  "PageUp|M-v|C-Up": { command: "goOrSelect", args: [commands.cursorPageUp, commands.selectPageDown] },
  "S-C-Down": commands.selectPageDown,
  "S-C-Up": commands.selectPageUp,

  // TODO use iSearch
  "C-s": openSearchPanel, // "iSearch", 
  "C-r": openSearchPanel, // "iSearchBackwards",

  "M-C-s": "findnext",
  "M-C-r": "findprevious",
  "S-M-5": "replace",

  // basic editing
  "Backspace": commands.deleteCharBackward,
  "Delete|C-d": commands.deleteCharForward,
  "Return|C-m": { command: "insertstring", args: "\n" }, // "newline"
  "C-o": commands.splitLine,

  "M-d|C-Delete": { command: "killWord", args: "right" },
  "C-Backspace|M-Backspace|M-Delete": { command: "killWord", args: "left" },
  "C-k": "killLine",

  "M-h": "selectParagraph",
  "M-@|M-S-2": "markWord",

  "C-y|S-Delete": "yank",
  "M-y": "yankRotate",
  "C-g": "keyboardQuit",

  "C-w|C-S-w": "killRegion",
  "M-w": "killRingSave",
  "C-Space": "setMark",
  "C-x C-x": "exchangePointAndMark",

  "C-t": commands.transposeChars,
  "M-u": { command: "changeCase", args: {dir: 1}},
  "M-l": { command: "changeCase", args: {dir: -1}},
  "C-x C-u": { command: "changeCase", args: {dir: 1, region: true}},
  "C-x C-l": { command: "changeCase", args: {dir: 1, region: true}},
  "M-/": startCompletion,
  "C-u": "universalArgument",

  "M-;": commands.toggleComment,

  "C-/|C-x u|S-C--|C-z": commands.undo,
  "S-C-/|S-C-x u|C--|S-C-z": commands.redo, // infinite undo?
  // vertical editing
  "C-x r": "selectRectangularRegion",
  "M-x": { command: "focusCommandLine", args: "M-x " },
  // todo
  // "C-x C-t" "M-t" "M-c" "F11" "C-M- "M-q"

  "Esc": "unsetTransientMark"
};


for (let i in emacsKeys) {
  EmacsHandler.bindKey(i, emacsKeys[i])
}

EmacsHandler.addCommands({
  unsetTransientMark: function(handler: EmacsHandler) {
    handler.setEmacsMark(null)
    return false
  },
  markWord: function(handler: EmacsHandler, args: any) {
    
  },
  selectParagraph: function(handler: EmacsHandler, args: any) {
    var view = handler.view
    var head = view.state.selection.ranges[0].head
    var doc = view.state.doc
    var startLine = doc.lineAt(head)
    var start = -1;
    var end = -1;
    
    var line = startLine;
    while (/\S/.test(line.text) && line.from > 0) {
      start = line.from
      line = view.state.doc.lineAt(line.from - 1)
    }
    if (start == -1) {
      while (!/\S/.test(line.text) && line.to < doc.length) {
        start = line.from
        line = view.state.doc.lineAt(line.to + 1)
      }
    } else {
      line = startLine
    }
    while (/\S/.test(line.text) && line.to < doc.length) {
      end = line.to
      line = view.state.doc.lineAt(line.to + 1)
    }
    if (end == -1) {
      end = startLine.to;
    }
    var newRanges = [EditorSelection.range(start, end)];
    view.dispatch({
      selection: EditorSelection.create(newRanges)
    })
  },
  goOrSelect: {
    exec: function(handler: EmacsHandler, args: any) {
      var command = handler.emacsMark() ? args[1] : args[0];
      command(handler.view);
    }
  },
  changeCase: function (handler: EmacsHandler, args: any) {
    var view = handler.view
    if (!args.region) {
      handler.clearSelection()
      commands.selectGroupForward(view)
    }
    
    var specs = view.state.changeByRange((range) => {
      var toInsert = view.state.sliceDoc(range.from, range.to)
      toInsert = args.dir == 1 ? toInsert.toUpperCase() : toInsert.toLowerCase()
      return { 
        changes: { from: range.from, to: range.to, insert: toInsert },
        range: EditorSelection.cursor(range.from + toInsert.length)
      }
    })
    view.dispatch(specs)
  },
  centerSelection: function (handler: EmacsHandler) {
    handler.view.dispatch({scrollIntoView: true})

  },
  recenterTopBottom: function (handler: EmacsHandler) {
    var view = handler.view
    var scrollTop = view.scrollDOM.scrollTop;
    view.dispatch({scrollIntoView: true})
    try {
      // force synchronous measurment
      (view as any).measure(true)
    } catch(e) {}

    if (scrollTop != view.scrollDOM.scrollTop) return;

    var base = view.scrollDOM.getBoundingClientRect()
    var cursor = view.coordsAtPos(view.state.selection.main.head)
    if (!cursor) return;
    
    var lineHeight = cursor.bottom - cursor.top
    var screenHeight = base.height;
    var cursorTop = cursor.top - base.top;

    if (Math.abs(cursorTop) < lineHeight/4) {
      scrollTop += cursorTop  + lineHeight - screenHeight + 2;
    } else if (Math.abs(cursorTop - screenHeight * 0.5) < lineHeight/4) {
      scrollTop += cursorTop - 2;
    } else {
      scrollTop += cursorTop - screenHeight * 0.5;
    }
    view.scrollDOM.scrollTop = scrollTop
  },
  selectRectangularRegion: function (handler: EmacsHandler) {
    var view = handler.view
    var ranges = view.state.selection.ranges;
    var newRanges = []
    if (ranges.length > 1) {
      newRanges.push(EditorSelection.range(ranges[0].from, ranges[ranges.length - 1].to))
    } else {
      let doc = view.state.doc;
      let startLine = doc.lineAt(ranges[0].from)
      let endLine = doc.lineAt(ranges[0].to)
      let startCollumn = ranges[0].from - startLine.from
      let endCollumn = ranges[0].to - endLine.from

      while (startLine.from < endLine.to) {
        newRanges.push(EditorSelection.range(startLine.from + startCollumn, startLine.from + endCollumn))
        if (startLine.to + 1 >= doc.length)
          break;
        startLine = doc.lineAt(startLine.to + 1)
      }
    }

    view.dispatch({
      selection: EditorSelection.create(newRanges)
    })
  },
  setMark: {
    exec: function (handler: EmacsHandler, args: any) {
      var view = handler.view;
      var ranges = view.state.selection.ranges
      // Sets mark-mode and clears current selection.
      // When mark is set, keyboard cursor movement commands become
      // selection modification commands. That is,
      // "goto" commands become "select" commands.
      // Any insertion or mouse click resets mark-mode.
      // setMark twice in a row at the same place resets markmode.
      // in multi select mode, ea selection is handled individually

      if (args && args.count) {
        var mark = handler.popEmacsMark();
        if (mark) {
          var newRanges = mark.map((p: number)=> {
            return EditorSelection.cursor(p, p)
          })
          view.dispatch({
            selection: EditorSelection.create(newRanges)
          })
        }
        return;
      }

      var mark = handler.emacsMark();
      var rangePositions = ranges.map(function (r) { return r.from; });
      var transientMarkModeActive = true;
      var hasNoSelection = ranges.every(function (range) { return range.from == range.to; });
      // if transientMarkModeActive then mark behavior is a little
      // different. Deactivate the mark when setMark is run with active
      // mark
      if (transientMarkModeActive && (mark || !hasNoSelection)) {
        handler.clearSelection();
        if (mark) handler.pushEmacsMark(null);
        return;
      }

      if (!mark) {
        handler.pushEmacsMark(rangePositions)
        handler.setEmacsMark(rangePositions);
        return;
      }

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    },
    readOnly: true,
    handlesCount: true
  },
  exchangePointAndMark: {
    exec: function exchangePointAndMark$exec(handler: EmacsHandler, args: any) {
      var view = handler.view;
      var selection = view.state.selection;
      var isEmpty = !selection.ranges.some(r => r.from != r.to)
      if (!args.count && !isEmpty) { // just invert selection
        var newRanges = selection.ranges.map(x => {
          return EditorSelection.range(x.head, x.anchor)
        })
        view.dispatch({
          selection: EditorSelection.create(newRanges, selection.mainIndex)
        })
        return;
      }

      var markRing = handler.$emacsMarkRing
      var lastMark = markRing[markRing.length - 1]
      if (!lastMark) return;

      if (args.count) { // replace mark and point
        handler.clearSelection();
        
        var newRanges = lastMark.map(x => {
          return EditorSelection.range(x, x)
        })
        view.dispatch({
          selection: EditorSelection.create(newRanges, selection.mainIndex)
        })

      } else { // create selection to last mark
        var n = Math.min(lastMark.length, selection.ranges.length)
        newRanges = []
        for (var i = 0; i < n; i++) {
          newRanges.push(EditorSelection.range(selection.ranges[i].head, lastMark[i]))
        }
      }
    },
    readOnly: true,
    handlesCount: true,
  },
  killWord: {
    exec: function (handler: EmacsHandler, dir: any) {
      var view = handler.view
      var selection = view.state.selection;
      var newRanges = selection.ranges.map(x => {
        return EditorSelection.range(x.head, x.head)
      })
      view.dispatch({
        selection: EditorSelection.create(newRanges, selection.mainIndex)
      })
      if (dir == "left")
        commands.selectGroupBackward(view)
      else
        commands.selectGroupForward(view)
      selection = view.state.selection;

      selection.ranges.forEach(r => {
        var text = view.state.sliceDoc(r.from, r.to)
        killRing.add(text);
      })

      view.dispatch(view.state.replaceSelection(""))
    },
  },
  killLine: function (handler: EmacsHandler) {
    handler.pushEmacsMark(null);
    // don't delete the selection if it's before the cursor
    handler.clearSelection();
    commands.selectLineEnd(handler.view);

    var view = handler.view;
    var state = view.state
    

    var text: string[] = [];
    var changes = handler.view.state.selection.ranges.map(function(range) {
      var from = range.from;
      var to = range.to;
      var line = state.sliceDoc(from, to)
      text.push(line)
      
      // remove EOL if only whitespace remains after the cursor
      if (/^\s*$/.test(line)) {
        to += 1;
        text.push("\n")
      }
      return {from, to, insert: ""}
    })
    
    if (handler.$data.lastCommand == "killLine")
      killRing.append(text.join("\n"));
    else
      killRing.add(text.join("\n"));

    view.dispatch({changes});
  },
  yank: function (handler: EmacsHandler) {
    handler.onPaste(killRing.get());
    handler.$data.lastCommand = "yank";
  },
  yankRotate: function (handler: EmacsHandler) {
    if (handler.$data.lastCommand != "yank")
      return;
    commands.undo(handler.view);
    handler.$emacsMarkRing.pop(); // also undo recording mark
    handler.onPaste(killRing.rotate());
    handler.$data.lastCommand = "yank";
  },
  killRegion: {
    exec: function (handler: EmacsHandler) {
      killRing.add(handler.getCopyText());
      var view = handler.view;
      view.dispatch(view.state.replaceSelection(""))
      handler.setEmacsMark(null);
    },
  },
  killRingSave: {
    exec: function (handler: EmacsHandler) {
      var text = handler.getCopyText()
      killRing.add(text);
      handler.clearSelection()
      navigator.clipboard.writeText(text);
    },
    readOnly: true
  },
  keyboardQuit: function (handler: EmacsHandler) {
    var view = handler.view;
    var selection = view.state.selection;
    var isEmpty = !selection.ranges.some(r => r.from != r.to)

    if (selection.ranges.length > 1 && !isEmpty) {
      var newRanges = selection.ranges.map(x => {
        return EditorSelection.range(x.head, x.head)
      })
      view.dispatch({
        selection: EditorSelection.create(newRanges, selection.mainIndex)
      })
    } else {
      commands.simplifySelection(handler.view);
    }

    handler.setEmacsMark(null);
    handler.$data.count = null;
  },
  focusCommandLine: function (handler: EmacsHandler, arg: string) {
    handler.showCommandLine(arg);
  }
});

const killRing = {
  $data: [] as string[],
  add: function (str: string) {
    str && this.$data.push(str);
    if (this.$data.length > 30)
      this.$data.shift();
  },
  append: function (str: string) {
    var idx = this.$data.length - 1;
    var text = this.$data[idx] || "";
    if (str) text += str;
    if (text) this.$data[idx] = text;
  },
  get: function (n?: number) {
    n = n || 1;
    return this.$data.slice(this.$data.length - n, this.$data.length).reverse().join('\n');
  },
  pop: function () {
    if (this.$data.length > 1)
      this.$data.pop();
    return this.get();
  },
  rotate: function () {
    let last = this.$data.pop()
    if (last) this.$data.unshift(last);
    return this.get();
  }
};

