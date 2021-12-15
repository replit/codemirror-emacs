# Emacs keybindings for CM6

## Installation

`npm i @replit/codemirror-emacs`

## Usage

```js
import { basicSetup, EditorState } from '@codemirror/basic-setup';
import { EditorView } from '@codemirror/view';
import { emacs } from "@replit/codemirror-emacs"

new EditorView({
    state: EditorState.create({
      doc: "",
      extensions: [
        // make sure emacs is included before other keymaps
        emacs(), 
        // include the default keymap and all other keymaps you want to use in insert mode
        basicSetup, 
      ]
    }),
    parent: document.querySelector('#editor'),
})
```
