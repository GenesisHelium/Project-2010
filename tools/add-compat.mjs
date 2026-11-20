// Adds the two small compatibility pieces a browser needs to run the 2010 pages.
//
// 1. Ajax Control Toolkit. The toolkit ships as its own ScriptResource bundle and
//    that bundle was never archived, so pages using an extender throw
//    `AjaxControlToolkit is not defined` inside Sys.Application's init pass. The
//    two extenders the site uses are an accordion and a modal popup; both are
//    implemented here as real Sys behaviours.
//
// 2. Roblox.Client. Some pages call Roblox.Client.isIDE() from an inline script
//    but were captured with a script list that does not include client-installer
//    .js. In a browser the answer is false either way, so the fallback is
//    accurate rather than a stub.
import { readFile, writeFile } from 'node:fs/promises';

const PATH = 'site/js/scriptresource-shared.js';

const ACT = `// --- Ajax Control Toolkit stand-in -------------------------------------------
// The toolkit bundle was never captured. The behaviours below let pages that use
// an extender finish initialising: the accordion leaves its panes open, and the
// modal popup keeps its panel hidden until show() is called.
if (typeof AjaxControlToolkit === 'undefined') {
    Type.registerNamespace('AjaxControlToolkit');

    AjaxControlToolkit.AccordionBehavior = function (element) {
        AjaxControlToolkit.AccordionBehavior.initializeBase(this, [element]);
    };
    AjaxControlToolkit.AccordionBehavior.prototype = {
        initialize: function () {
            AjaxControlToolkit.AccordionBehavior.callBaseMethod(this, 'initialize');
        },
        dispose: function () {
            AjaxControlToolkit.AccordionBehavior.callBaseMethod(this, 'dispose');
        }
    };
    AjaxControlToolkit.AccordionBehavior.registerClass(
        'AjaxControlToolkit.AccordionBehavior', Sys.UI.Behavior);

    AjaxControlToolkit.ModalPopupBehavior = function (element) {
        AjaxControlToolkit.ModalPopupBehavior.initializeBase(this, [element]);
        this._popup = null;
    };
    AjaxControlToolkit.ModalPopupBehavior.prototype = {
        initialize: function () {
            AjaxControlToolkit.ModalPopupBehavior.callBaseMethod(this, 'initialize');
            this._popup = this._findPopup();
            if (this._popup) this._popup.style.display = 'none';
        },
        _findPopup: function () {
            var props = this._properties;
            var id = props && props.PopupControlID;
            return id ? document.getElementById(id) : null;
        },
        show: function () {
            if (!this._popup) this._popup = this._findPopup();
            if (this._popup) this._popup.style.display = '';
        },
        hide: function () {
            if (this._popup) this._popup.style.display = 'none';
        },
        dispose: function () {
            AjaxControlToolkit.ModalPopupBehavior.callBaseMethod(this, 'dispose');
        }
    };
    AjaxControlToolkit.ModalPopupBehavior.registerClass(
        'AjaxControlToolkit.ModalPopupBehavior', Sys.UI.Behavior);
}

`;

const CLIENT = `// --- Roblox.Client fallback --------------------------------------------------
// client-installer.js defines this namespace and is loaded on most pages. A few
// captured pages call Roblox.Client.isIDE() without it, so the browser answer is
// supplied here when the real one is absent.
if (typeof Roblox !== 'undefined' && !Roblox.Client) {
    Roblox.Client = {
        isIDE: function () { return false; },
        isStudio: function () { return false; },
        _skip: ''
    };
}

`;

const LAUNCH = `// --- RobloxLaunch fallback ---------------------------------------------------
// place-launcher.js defines this object and is loaded on pages with a Play
// button. A few captured pages reference RobloxLaunch without it, and their
// inline boot code assigns onto it. The launcher itself talks to a game client
// over HTTP, which cannot work against a mirror, so what is installed here is the
// object shape those pages touch and no more.
if (typeof RobloxLaunch === 'undefined') {
    window.RobloxLaunch = {
        _LaunchGamePage: null,
        _Timer: null,
        _ClientMetricType: null,
        _Launcher: null,
        RequestGame: function () {},
        RequestPlayWithParty: function () {},
        RequestGroupBuildGame: function () {},
        RequestGameJob: function () {},
        RequestFollowUser: function () {}
    };
}

`;

const before = await readFile(PATH, 'utf8');
let out = before;
let added = 0;

if (!out.includes("Type.registerNamespace('AjaxControlToolkit')")) {
  out = ACT + out;
  added++;
}
if (!out.includes('Roblox.Client = {')) {
  out = CLIENT + out;
  added++;
}
if (!out.includes('RobloxLaunch = {')) {
  out = LAUNCH + out;
  added++;
}

if (added) {
  await writeFile(PATH, out);
  console.log(`compat added to ${PATH} (${before.length} -> ${out.length} bytes)`);
} else {
  console.log('compat already present');
}
