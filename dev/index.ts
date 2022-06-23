import { basicSetup, EditorView } from 'codemirror';
import { highlightActiveLine } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { xml } from '@codemirror/lang-xml';
import { emacs } from "../src/"

import * as commands from "@codemirror/commands";
(window as any)._commands = commands

const doc = `
import { basicSetup, EditorView } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { emacs } from "../src/"

const doc = \`
console.log('hi')
\`

new EditorView({
  doc,
  extensions: [emacs(), basicSetup, javascript()],
  parent: document.querySelector('#editor'),
});

`;


let wrapCheckbox = document.getElementById("wrap") as HTMLInputElement
wrapCheckbox.checked = localStorage.wrap == "true"
wrapCheckbox.onclick = function() {
  updateView();
  localStorage.wrap = wrapCheckbox.checked;
}
let htmlCheckbox = document.getElementById("html") as HTMLInputElement
htmlCheckbox.checked = localStorage.html == "true"
htmlCheckbox.onclick = function() {
  updateView();
  localStorage.html = htmlCheckbox.checked;
}

let view
function updateView() {
  if (view) view.destroy()
  view = (window as any)._view = new EditorView({
    doc: htmlCheckbox.checked ? document.documentElement.outerHTML : doc,
    extensions: [
      emacs(),
      basicSetup,
      htmlCheckbox.checked ? xml(): javascript(),
      highlightActiveLine(),
      wrapCheckbox.checked && EditorView.lineWrapping,
    ].filter(Boolean),
    parent: document.querySelector('#editor'),
  });
}


updateView()