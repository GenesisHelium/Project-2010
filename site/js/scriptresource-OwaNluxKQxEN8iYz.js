// Register the namespace for the control.
Type.registerNamespace('Roblox.Thumbs');

//
// Define the control properties.
//
Roblox.Thumbs.Image = function(element) {
    Roblox.Thumbs.Image.initializeBase(this, [element]);
    this._fileExtension = null;
    this._spinnerUrl = null;
    this._pollTime = 3000;
    this._waitTime = 0;
    this._webService = null;
    this._requestThumbnail = null;
    this._updateTimeout = null;
    this._spinner = null;
}

//
// Create the prototype for the control.
//
Roblox.Thumbs.Image.prototype = {

    initialize: function() {
        Roblox.Thumbs.Image.callBaseMethod(this, 'initialize');
    },

    dispose: function() {
        if (typeof (this._updateTimeout) !== 'undefined')
            window.clearTimeout(this._updateTimeout);
        Roblox.Thumbs.Image.callBaseMethod(this, 'dispose');
    },

    _showSpinner: function() {
        if (this._spinner !== null)
            return;

        this.get_element().style.position = "relative";
        this._spinner = document.createElement("img");
        this._spinner.style.position = "absolute";
        this._spinner.style.left = "0px";
        this._spinner.style.top = "0px";
        this._spinner.style.height = "16px";
        this._spinner.style.width = "16px";
        this._spinner.style.border = 0;
        this._spinner.src = this._spinnerUrl;
        this.get_element().appendChild(this._spinner);
    },

    _hideSpinner: function() {
        if (!this._spinner)
            return;
        this.get_element().removeChild(this._spinner);
        this._spinner = null;
    },

    _onUpdate: function() {

        if (!this._webService) {
            this._hideSpinner();
            return;
        }
        this._showSpinner();
        this._requestThumbnail();
    },

    _onUrl: function(result) {

        if (!this.get_element()) {
            this._hideSpinner();
            return;
        }

        Roblox.Controls.Image.SetImageSrc(this.get_element(), result.url);

        if ((!result.final || result.url.indexOf("unavail")>0 ) && this._waitTime <= 40)   // Give up after 40 times.
        {
            // Try again later
            this._waitTime = parseInt(this._waitTime) + parseInt(1);
            this._updateTimeout = window.setTimeout(Function.createDelegate(this, this._onUpdate), this._pollTime);
        }
        else
            this._hideSpinner();
    },

    _onError: function(result) {
        this._hideSpinner();
    },

    get_thumbnailFormatID: function() {
        return this._thumbnailFormatID;
    },

    set_thumbnailFormatID: function(value) {
        if (this._thumbnailFormatID !== value) {
            this._thumbnailFormatID = value;
            this.raisePropertyChanged('thumbnailFormatID');
        }
    },

    get_pollTime: function() {
        return this._pollTime.value;
    },
    
    set_pollTime: function(value) {
        if (this._pollTime !== value) {
            this._pollTime = value;
            this.raisePropertyChanged('pollTime');
        }
    },

    get_fileExtension: function() {
        return this._fileExtension;
    },

    set_fileExtension: function(value) {
        if (this._fileExtension !== value) {
            this._fileExtension = value;
            this.raisePropertyChanged('fileExtension');
        }
    },

    get_spinnerUrl: function() {
        return this._spinnerUrl;
    },

    set_spinnerUrl: function(value) {
        if (this._spinnerUrl !== value) {
            this._spinnerUrl = value;
            this.raisePropertyChanged('spinnerUrl');
        }
    }
}

// Optional descriptor for JSON serialization.
Roblox.Thumbs.Image.descriptor = {
    properties: [ ]
}

// Register the class as a type that inherits from Sys.UI.Control.
Roblox.Thumbs.Image.registerClass('Roblox.Thumbs.Image', Sys.UI.Control);
// Register the namespace for the control.
Type.registerNamespace('Roblox.Thumbs');

//
// Define the control properties.
//
Roblox.Thumbs.AssetImage = function(element) {
    Roblox.Thumbs.AssetImage.initializeBase(this, [element]);
    this._assetID = 0;
    this._assetVersionID = null;
    this._ov = false;
}

//
// Create the prototype for the control.
//
Roblox.Thumbs.AssetImage.prototype = {

    initialize: function() {
        Roblox.Thumbs.AssetImage.callBaseMethod(this, 'initialize');
        this._webService = Roblox.Thumbs.Asset;
        this._requestThumbnail = Function.createDelegate(this, this.requestThumbnail);
    },

    dispose: function() {
        Roblox.Thumbs.AssetImage.callBaseMethod(this, 'dispose');
    },

    get_assetID: function() {
        return this._assetID;
    },

    set_assetID: function(value) {
        if (this._assetID !== value) {
            this._assetID = value;
            this.raisePropertyChanged('assetID');
        }
    },

    get_assetVersionID: function() {
        return this._assetVersionID;
    },

    set_assetVersionID: function(value) {
        if (this._assetVersionID !== value) {
            this._assetVersionID = value;
            this.raisePropertyChanged('assetVersionID');
        }
    },

    get_ov: function() {
        return this._ov;
    },

    set_ov: function(value) {
        if (this._ov !== value) {
            this._ov = value;
            this.raisePropertyChanged('ov');
        }
    },

    requestThumbnail: function() {
        var style = this.get_element().style;
        var width = style.pixelWidth;
        var height = style.pixelHeight;

        var onSuccess = function(result, context) { context._onUrl(result); };
        var onError = function(result, context) { context._onError(result); };

        this._webService.RequestThumbnail_v2(this._assetID, this._assetVersionID, width, height, this._fileExtension, this._thumbnailFormatID, this._ov, onSuccess, onError, this);
    }
}

// Optional descriptor for JSON serialization.
Roblox.Thumbs.AssetImage.descriptor = {
    properties: [ ]
}

// Register the class as a type that inherits from Sys.UI.Control.
Roblox.Thumbs.AssetImage.registerClass('Roblox.Thumbs.AssetImage', Roblox.Thumbs.Image);

Roblox.Thumbs.AssetImage.updateUrl = function(componentID) {
    /// <summary>
    /// This static function (that is intended to be called from script emitted
    /// on the server)
    /// </summary>
    var a = $find(componentID);
    a._onUpdate();
}

