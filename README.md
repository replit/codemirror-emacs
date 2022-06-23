# Emacs keybindings for CM6

<span><a href="https://replit.com/@util/codemirror-emacs" title="Run on Replit badge"><img src="https://replit.com/badge/github/replit/codemirror-emacs" alt="Run on Replit badge" /></a></span>
<span><a href="https://www.npmjs.com/package/@replit/codemirror-emacs" title="NPM version badge"><img src="https://img.shields.io/npm/v/@replit/codemirror-emacs?color=blue" alt="NPM version badge" /></a></span>

## Installation

`npm i @replit/codemirror-emacs`

## Usage

```js
import { basicSetup, EditorView } from 'codemirror';
import { emacs } from "@replit/codemirror-emacs"

new EditorView({
  doc: "",
  extensions: [
    // make sure emacs is included before other keymaps
    emacs(), 
    // include the default keymap and all other keymaps you want to use in insert mode
    basicSetup, 
  ],
  parent: document.querySelector('#editor'),
})
```
