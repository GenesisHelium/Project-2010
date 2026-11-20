Type.registerNamespace('Roblox.Client');

function tryToDownload(url)
{

    oIFrm = document.getElementById('downloadInstallerIFrame');
    oIFrm.src = url;
}

function logStatistics(reqType)
{
    $.get("/install/VisitButtonHandler.ashx?reqtype=" + reqType, function(data) { });
}

Roblox.Client._installHost = null;
Roblox.Client._installSuccess = null;
Roblox.Client._CLSID = null;    
Roblox.Client._continuation = null;    
Roblox.Client._skip = null;    
Roblox.Client._isIDE = null;
Roblox.Client._isRobloxBrowser = null;
Roblox.Client._isPlaceLaunch = false;

Roblox.Client.ReleaseLauncher = function(o) {
    if (o != null) {
        $('#pluginObjDiv').html('');
        o = null;
    }
}

Roblox.Client.GetInstallHost = function(o) {
    if (window.ActiveXObject) // IE
    {
        return o.InstallHost;
    }
    else // Firefox
    {
        // GROSS DISGUSTING HACK:  Firefox plugin for some reason is tacking on an extra character to the end of the install host.
        var val = o.Get_InstallHost();
        return val.substring(0, val.length - 1);
    }
}

Roblox.Client.CreateLauncher = function() 
{
    if (Roblox.Client._installHost == null || Roblox.Client._CLSID == null)  // Need to init these properties
    {
        if (typeof initClientProps == 'function') {
            initClientProps();
        }
    }

    var pluginObj = document.getElementById('robloxpluginobj');
    var pluginDiv = $('#pluginObjDiv');

    // Check to see if it's already installed
    // If it isn't installed, add it
    if (!pluginObj) {
        if (window.ActiveXObject) {
            // browser supports ActiveX
            // Create object element with
            // download URL for IE OCX

            var pluginString = "<object classid=\"clsid:" + Roblox.Client._CLSID + "\"";
            pluginString += " id=\"robloxpluginobj\" type=\"application/x-vnd-roblox-launcher\">";
            pluginString += " codebase=\"" + Roblox.Client._installHost + "\">Failed to INIT Plugin</object>";

            $(pluginDiv).append(pluginString);
        }
        else {
            // browser supports Netscape Plugin API
            var pluginString = "<object id=\"robloxpluginobj\" type=\"application/x-vnd-roblox-launcher\">";
            pluginString += "<p>You need Our Plugin for this.  Get the latest version from";
            pluginString += "<a href=\"" + Roblox.Client._installHost + "\">here</a>.</p></object>";

            $(pluginDiv).append(pluginString);
        }

        pluginObj = document.getElementById('robloxpluginobj');
    }

    try {
        if (!pluginObj)
            alert("Plugin installation failed!");
        pluginObj.Hello(); // fails if object isn't fully loaded


        // Get the install host info for this plugin (different for IE vs Mozilla)
        var host = Roblox.Client.GetInstallHost(pluginObj);

        if (!host || host != Roblox.Client._installHost)
            throw "wrong InstallHost: (plugins):  " + host + "  (servers):  " + Roblox.Client._installHost;
        return pluginObj;
    }
    catch (ex) {
        Roblox.Client.ReleaseLauncher(pluginObj);
        return null;
    }
}

Roblox.Client.isIDE = function() {
    if (Roblox.Client._isIDE == null) {
        Roblox.Client._isIDE = false;
        Roblox.Client._isRobloxBrowser = false;

        if (window.external) {
            try {
                if (window.external.IsRobloxAppIDE !== undefined) {
                    Roblox.Client._isIDE = window.external.IsRobloxAppIDE;
                    Roblox.Client._isRobloxBrowser = true;
                }
            }
            catch (ex) {
            }
        }
    }
    return Roblox.Client._isIDE;
}

Roblox.Client.isRobloxBrowser = function() {
    Roblox.Client.isIDE();
    return Roblox.Client._isRobloxBrowser;
}

Roblox.Client.robloxBrowserInstallHost = function() {
    if (window.external) {
        try {
            return window.external.InstallHost;
        }
        catch (ex) {

        }
    }
    return "";
}

Roblox.Client.IsRobloxProxyInstalled = function() {
    var o = Roblox.Client.CreateLauncher();
    var isInstalled = false;
    if (o != null)
    { isInstalled = true; }
    Roblox.Client.ReleaseLauncher(o);

    if (isInstalled || Roblox.Client.isRobloxBrowser())
        return true;
    return false;
}

Roblox.Client.IsRobloxInstalled = function() {
    try {
        var o = Roblox.Client.CreateLauncher();

        var host = Roblox.Client.GetInstallHost(o);
        Roblox.Client.ReleaseLauncher(o);
        // TODO: Check version, etc.
       
        return host == Roblox.Client._installHost;
    }
    catch (e) {
        if (Roblox.Client.isRobloxBrowser()) {
            host = Roblox.Client.robloxBrowserInstallHost();
            return host == Roblox.Client._installHost;
        }

        return false;
    }
}

Roblox.Client.Update = function() {
    try {
        var o = Roblox.Client.CreateLauncher();
        o.Update();
        Roblox.Client.ReleaseLauncher(o);
    }
    catch (e) {
        alert('Error updating: ' + e);
    }
}


Roblox.Client.WaitForRoblox = function(continuation) {
    if (Roblox.Client._skip) {
        window.location = Roblox.Client._skip;
        return false;
    }
    Roblox.Client._continuation = continuation;
    Roblox.Client._cancelled = false;

    if (!Roblox.Client.IsRobloxProxyInstalled()) {
        // Show the "Installation Instructions" screen
        Roblox.Client.LoadImages();
        $('#InstallationInstructions').modal({ escClose: true,
            //onClose: function() { Roblox.Client._onCancel(); },
            opacity: 50,
            overlayCss: { backgroundColor: "#000"},
            containerCss: { marginLeft: "-195px"},
            position: [10, "50%"]
             
        });

        // Set a timer to continue launching the game 
        window.setTimeout(function() { Roblox.Client._ontimer(); }, 1000);
        return true;
    }
    else {
        Roblox.Client._continuation();
        return false;
    }
}
Roblox.Client.LoadImages = function()
{
    var ie7 = $('#ie7_install_img');
    if (ie7)
        $(ie7).attr('src', "/images/install/ieInstall_preview.png");
    var ie6 = $('#ie6_install_img');
    if (ie6)
        $(ie6).attr('src', "/images/install/ie6.png");
    var firefox = $('#firefox_install_img');
    if (firefox)
        $(firefox).attr('src', "/images/install/firefoxInstall_preview.png");
}

Roblox.Client._onCancel = function() {
    $.modal.close();
    Roblox.Client._cancelled = true;
    return false;
}

Roblox.Client._ontimer = function() {
    if (Roblox.Client._cancelled)
        return;

    if (Roblox.Client.IsRobloxProxyInstalled()) {
        $.modal.close();
        //Roblox.Client._modalBehavior.hide();
        Roblox.Client._continuation();
        if (Roblox.Client._installSuccess)
            Roblox.Client._installSuccess();
    }
    else {
        window.setTimeout(function() { Roblox.Client._ontimer(); }, 1000);
    }
}


