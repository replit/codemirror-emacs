import {EditorView, basicSetup} from "codemirror"
import {EditorState} from "@codemirror/state"
import {xml} from "@codemirror/lang-xml"
import {javascript} from "@codemirror/lang-javascript"
import ist from "ist";
import { indentUnit } from "@codemirror/language";
import { keymap } from "@codemirror/view";


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
    it("does nothing", function() {

    });
});
