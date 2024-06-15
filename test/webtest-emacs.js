import {EditorView, basicSetup} from "codemirror"
import {xml} from "@codemirror/lang-xml"
import {javascript} from "@codemirror/lang-javascript"
import { indentUnit } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import { emacs } from ".."
import { EditorState, EditorSelection } from "@codemirror/state";
import {indentWithTab} from "@codemirror/commands";

console.log("-----------------------------")

describe("Emacs keybinding", () => {
    /**@type {HTMLDivElement}*/
    var root
    function addRoot() {
        if (!root) {
            root = document.createElement("div")
            root.id = "testground"
            root.style.height = "300px";
            root.style.position = "fixed"
            root.style.top = "100px"
            root.style.left = "200px"
            root.style.width = "500px" 
        }
        document.body.appendChild(root)
    }
    addRoot()
    
    function test(name, fn) {
        it(name, function() {
            fn();
        })
    }
    function eqCursorPos(a, b) {
        if (a.line != b.line || a.ch != b.ch)
            throw failure(
                "Expected cursor position " + JSON.stringify([a.line, a.ch]) +
                " to be equal to " + JSON.stringify([b.line, b.ch]),
                eqCursorPos
            );
    }
    function eq(a, b, _reason) {
        if (a != b)
            throw failure("Expected " + a + " to be equal to " + b, eq);
    }
    function is(a) {
        if (!a) throw failure("Expected " + a + " to be truthy", is);
    }
    function failure(message, root) {
        var error = new Error(message);
        if (Error.captureStackTrace)
            Error.captureStackTrace(error, root);
        return error;
    }
    

    var editor;
    function initEditor(value, options = {}) {
        addRoot();
        if (editor) editor.destroy();

        var view = new EditorView({
            doc: value,
            extensions: [
                emacs(),
                basicSetup,
                options.mode == "xml" ? xml() : javascript(),
                EditorState.tabSize.of(options.tabSize || 4),
                indentUnit.of(
                    options.indentWithTabs ? "\t" : " ".repeat(options.indentUnit || 2)
                ),
                options.lineWrapping && EditorView.lineWrapping,
                keymap.of([indentWithTab]),
            ].filter(Boolean),
            parent: root,
        });
        editor = view;
        window.view = view;

        view.contentDOM._handleInputEventForTest = function(text) {           
            view.dispatch(view.state.replaceSelection(text))
        };

        view.dom.style.backgroundColor = "white";        
        view.dom.style.width = "420px"
        view.dom.style.height = "300px"
        // without calling refresh cursor movement commands of codemirror 6 do not work
        view.measure()
        view.contentDOM.focus()

        var plugins = view.plugins.filter(x=>x.value.em)
        if (plugins.length != 1) throw new Error("Couldn't find emacs")
        view.em = plugins[0].value.em;
    }
    function getSelectedText() {        
        var state = editor.state
        return state.selection.ranges.map(r => state.sliceDoc(r.from, r.to)).join("\n")
    }
    function getValue() {
        return editor.state.doc.toString()
    }
    function getSelections() {        
        var state = editor.state
        return state.selection.ranges.map(r => r.anchor+ ">" +r.head).join(",")
    }
    function setSelections(ranges, primIndex = 0) {
        ranges = ranges.map(range => {
            if (typeof range == "number")
                return EditorSelection.cursor(range, 1)
            return EditorSelection.range(range[0], range[1])
        })
        editor.dispatch({
            selection: EditorSelection.create(ranges, primIndex)
        })
    }
    
    test("keyboardQuit clears selection", function() {
        initEditor('foo');
        typeKey('Ctrl-x', 'Ctrl-p');
        eq(getSelectedText(), "foo")
        typeKey('Ctrl-g');
        eq(getSelectedText(), "")
    })
    test("exchangePointAndMark without mark set", function() {
        initEditor('foo');
        setSelections([[1, 3]]);
        eq(getSelections(), "1>3");
        typeKey('Ctrl-x', 'Ctrl-x');
        eq(getSelections(), "3>1");
    });

    test("exchangePointAndMark with mark set", function() {
        initEditor('foo');
        editor.em.pushEmacsMark({row: 0, column: 1});
        editor.em.pushEmacsMark({row: 0, column: 2});
        typeKey('Ctrl-x', 'Ctrl-x');
        typeKey('Ctrl-x', 'Ctrl-x');
        typeKey('Ctrl-x', 'Ctrl-x');
        typeKey('Ctrl-x', 'Ctrl-x');
        eq({row: 0, column: 2}, editor.getCursorPosition());
        eq([{row: 0, column: 1}, {row: 0, column: 0}], editor.session.$emacsMarkRing, print(editor.session.$emacsMarkRing));
    });

    // test("exchangePointAndMark with selection", function() {
    //     initEditor('foo');
    //     editor.pushEmacsMark({row: 0, column: 1});
    //     editor.pushEmacsMark({row: 0, column: 2});
    //     sel.setRange(Range.fromPoints({row: 0, column: 0}, {row: 0, column: 1}), true);
    //     editor.execCommand('exchangePointAndMark');
    //     eq({row: 0, column: 1}, editor.getCursorPosition());
    //     eq([{row: 0, column: 1}, {row: 0, column: 2}], editor.session.$emacsMarkRing, print(editor.session.$emacsMarkRing));
    // });

    // test("exchangePointAndMark with multi selection", function() {
    //     initEditor('foo\nhello world\n123');
    //     var ranges = [[{row: 0, column: 0}, {row: 0, column: 3}],
    //                   [{row: 1, column: 0}, {row: 1, column: 5}],
    //                   [{row: 1, column: 6}, {row: 1, column: 11}]];
    //     ranges.forEach(function(r) {
    //         sel.addRange(Range.fromPoints(r[0], r[1]));
    //     });
    //     assert.equal("foo\nhello\nworld", editor.getSelectedText());
    //     editor.execCommand('exchangePointAndMark');
    //     assert.equal("foo\nhello\nworld", editor.getSelectedText());
    //     eq(pluck(ranges, 0), pluck(sel.getAllRanges(), 'cursor'), "selections dir not inverted");
    // });

    // test("exchangePointAndMark with multi cursors", function() {
    //     initEditor('foo\nhello world\n123');
    //     var ranges = [[{row: 0, column: 0}, {row: 0, column: 3}],
    //                   [{row: 1, column: 0}, {row: 1, column: 5}],
    //                   [{row: 1, column: 6}, {row: 1, column: 11}]];
    //     // move cursors to the start of each range and set a mark to its end
    //     // without selecting anything
    //     ranges.forEach(function(r) {
    //         editor.pushEmacsMark(r[1]);
    //         sel.addRange(Range.fromPoints(r[0], r[0]));
    //     });
    //     eq(pluck(ranges, 0), pluck(sel.getAllRanges(), 'cursor'), print(sel.getAllRanges()));
    //     editor.execCommand('exchangePointAndMark');
    //     eq(pluck(ranges, 1), pluck(sel.getAllRanges(), 'cursor'), "not inverted: " + print(sel.getAllRanges()));
    // });

    // test("setMark with multi cursors", function() {
    //     initEditor('foo\nhello world\n123');
    //     var positions = [{row: 0, column: 0},
    //                      {row: 1, column: 0},
    //                      {row: 1, column: 6}];
    //     positions.forEach(function(p) { sel.addRange(Range.fromPoints(p,p)); });
    //     editor.execCommand('setMark');
    //     eq(positions, editor.session.$emacsMarkRing, print(editor.session.$emacsMarkRing));
    // });

    test("killLine", function() {
        initEditor("foo  \n Hello world\n  \n  123");
        setSelections([[0, 2]]);
        typeKey('Ctrl-k');
        eq(getValue(),"fo\n Hello world\n  \n  123");
        typeKey('Ctrl-k');
        eq(getValue(),"fo Hello world\n  \n  123");
        typeKey('Ctrl-k');
        eq(getValue(),"fo\n  \n  123");
        typeKey('Ctrl-k');
        // eq(getValue(),"fo\n  123");
        // typeKey('Ctrl-k');
        // eq(getValue(),"fo  123");
        // typeKey('Ctrl-k');
        // eq(getValue(),"fo");
        // typeKey('Ctrl-k');
        // typeKey('Ctrl-y');
        // eq(getValue(),"foo  \n Hello world\n  \n  123");
    });

});



var typeKey = function() {
    var keyCodeToKey = {};
    var keyCodeToCode = {};
  
    var alias = {};
    alias.Ctrl = "Control";
    alias.Option = "Alt";
    alias.Cmd = alias.Super = alias.Meta = "Command";
  
    var controlKeys = {
      Shift: 16, Control: 17, Alt: 18, Meta: 224, Command: 224,
      Backspace:8, Tab:9, Return: 13, Enter: 13,
      Pause: 19, Escape: 27, PageUp: 33, PageDown: 34, End: 35, Home: 36,
      Left: 37, Up: 38, Right: 39, Down: 40, Insert: 45, Delete: 46,
      ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
    };
    var shiftedKeys = {};
    var printableKeys = {};
    var specialKeys = {
      Backquote: [192, "`", "~"], Minus: [189, "-", "_"], Equal: [187, "=", "+"],
      BracketLeft: [219, "[", "{"], Backslash: [220, "\\", "|"], BracketRight: [221, "]", "}"],
      Semicolon: [186, ";", ":"], Quote: [222, "'", '"'], Comma: [188, ",", "<"],
      Period: [190, ".", ">"], Slash: [191, "/", "?"], Space: [32, " ", " "], NumpadAdd: [107, "+"],
      NumpadDecimal: [110, "."], NumpadSubtract: [109, "-"], NumpadDivide: [111, "/"], NumpadMultiply: [106, "*"]
    };
    for (var i in specialKeys) {
      var key = specialKeys[i];
      printableKeys[i] = printableKeys[key[1]] = shiftedKeys[key[2]] = key[0];
      keyCodeToCode[key[0]] = i;
      keyCodeToKey[key[0]] = key[1];
      keyCodeToKey["s-" + key[0]] = key[2];
    }
    for (var i = 0; i < 10; i++) {
      var shifted = "!@#$%^&*()"[i];
      printableKeys[i] = shiftedKeys[shifted] = 48 + i;
      keyCodeToCode[48 + i] = "Digit" + i;
      keyCodeToKey[48 + i] = i.toString();
      keyCodeToKey["s-" + (48 + i)] = shifted;
    }
    for (var i = 65; i < 91; i++) {
      var chr = String.fromCharCode(i + 32);
      printableKeys[chr] = shiftedKeys[chr.toUpperCase()] = i;
      keyCodeToCode[i] = "Key" + chr.toUpperCase();
      keyCodeToKey[i] = chr;
      keyCodeToKey["s-" + i] = chr.toUpperCase();
    }
    for (var i = 1; i < 13; i++) {
      controlKeys["F" + i] = 111 + i;
    }
  
    for (var i in controlKeys) {
      keyCodeToKey[controlKeys[i]] = i;
      keyCodeToCode[controlKeys[i]] = i;
    }
    controlKeys["\t"] = controlKeys.Tab;
    controlKeys["\n"] = controlKeys.Return;
    controlKeys.Del = controlKeys.Delete;
    controlKeys.Esc = controlKeys.Escape;
    controlKeys.Ins = controlKeys.Insert;
  
    var shift = false;
    var ctrl = false;
    var meta = false;
    var alt = false;
    function reset() {
      shift = ctrl = meta = alt = false;
    }
    function updateModifierStates(keyCode) {
      if (keyCode == controlKeys.Shift)
        return shift = true;
      if (keyCode == controlKeys.Control)
        return ctrl = true;
      if (keyCode == controlKeys.Meta)
        return meta = true;
      if (keyCode == controlKeys.Alt)
        return alt = true;
    }
  
    function sendKey(letter, options) {
      var keyCode = controlKeys[letter] || printableKeys[letter] || shiftedKeys[letter];
      var isModifier = updateModifierStates(keyCode);
  
      var text = letter;
      var isTextInput = true;
      if (ctrl || alt || meta) {
        isTextInput = false;
      } else if (controlKeys[letter]) {
          if (keyCode == controlKeys.Return) {
              text = "\n";
              isTextInput = true;
          } else {
              isTextInput = false;
          }
      } else if (shift) {
        text = text.toUpperCase();
      }
  
      if (keyCodeToKey[keyCode] != text && keyCodeToKey["s-" + keyCode] == text) {
        shift = true;
      }
      var key = keyCodeToKey[(shift ? "s-" : "") + keyCode];
      
      if (options && options.macAltText) {
        alt = true;
        text = key = options.macAltText;
        isTextInput = true;
      }
  
      var target = document.activeElement;
      var prevented = emit("keydown", true);
      if (isModifier) return;
      if (!prevented && isTextInput) prevented = emit("keypress", true);
      if (!prevented && ctrl && !alt && !meta && letter == "c") emitClipboard("copy");
      if (!prevented) updateTextInput();
      emit("keyup", true);
  
      function emitClipboard(eventType) {
        var data = {bubbles: true, cancelable:true};
        var event = new KeyboardEvent(eventType, data);
        event.clipboardData = {
          setData: function(mime, text) {
            type.clipboard.$data = text;
          },
          getData: function() {
            return type.clipboard.$data;
          },
          clearData: function() {},
        };
        target.dispatchEvent(event);
      }
      function emit(type, bubbles) {
        var el = document.activeElement;
        var data = {bubbles: bubbles, cancelable:true};
        data.charCode = text.charCodeAt(0);
        data.keyCode = type == "keypress" ? data.charCode : keyCode;
        data.which = data.keyCode;
        data.shiftKey = shift || (shiftedKeys[text] && !printableKeys[text]);
        data.ctrlKey = ctrl;
        data.altKey = alt;
        data.metaKey = meta;
        data.key = key;
        data.code = keyCodeToCode[keyCode];
        var event = new KeyboardEvent(type, data);
  
        var el = document.activeElement;
        el.dispatchEvent(event);
        return event.defaultPrevented;
      }
      function updateTextInput() {
        if (!isTextInput && keyCode == controlKeys.Return) {
          text = "\n";
        }
        if (target._handleInputEventForTest) {
          if (!isTextInput) return;
          return target._handleInputEventForTest(text);
        }
        var isTextarea = "selectionStart" in target && typeof target.value == "string";
        if (!isTextarea) return;
  
        var start = target.selectionStart;
        var end = target.selectionEnd;
        var value = target.value;
  
        if (!isTextInput) {
          if (keyCode == controlKeys.Backspace) {
            if (start != end) start = Math.max(start - 1, 0);
          } else if (keyCode == controlKeys.Delete) {
            if (start != end) end = Math.min(end + 1, value.length);
          } else {
            return;
          }
        }
        var newValue = value.slice(0, start) + text + value.slice(end);
        var newStart = start + text.length;
        var newEnd = newStart;
        if (newValue != value || newStart != start || newEnd != end) {
          target.value = newValue;
          target.setSelectionRange(newStart, newEnd);
          emit("input", false);
        }
      }
    }
  
    function type() {
      var keys = Array.prototype.slice.call(arguments);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (Array.isArray(key)) {
          type.apply(null, key);
          continue;
        }
        reset();
        if (key.length > 1) {
          var isKeyName = controlKeys[key] || printableKeys[key] || shiftedKeys[key];
          if (!isKeyName) {
            var parts = key.split("-");
            var modifiers = parts.slice(0, parts.length - 1).map(function(part) {
              return controlKeys[alias[part] || part];
            });
            var isValid = modifiers.length && modifiers.every(updateModifierStates);
            if (!isValid) {
              type.apply(null, key.split(""));
              continue;
            }
            key = parts.pop();
            parts.forEach(function(part) {
              var keyCode = controlKeys[part];
              updateModifierStates(keyCode);
            });
          }
        }
        sendKey(key);
      }
    }
  
    // emulates option-9 inputting } on mac swiss keyboard
    type.optionTextInput = function(letter, altText) {
      reset();
      sendKey(letter, {macAltText: altText});
    };
  
    type.clipboard = {};
  
    return type;
  }();
  