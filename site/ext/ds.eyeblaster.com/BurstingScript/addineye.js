//	pos : Default display page location
var pos = "parent.parent";
//	Try cutting the domain until we'll reach the domain that fit the display page
//	(The addineye can be taken from a subdomain of the main page)
function setDomain()
{
	var d = document.domain;

	while(d.split(".").length >= 2)
	{
		try{
			fValid=0;
			document.domain = d;

			var strDispDomain = pos + ".document.domain";
			var strDomain = eval("try{"+strDispDomain + ";fValid=1}catch(e){}");
			if(fValid)
				return true;
		} catch(e){}
		
		d = d.substr(d.indexOf(".")+1,d.length);
	}
	return false;
}

//	Look for strHTML in the location string - this is the banner data that we need to put
//	in the page
function ebWriteTags()
{
	try{
		//we used to use document.open to replace addineye iframe document with 
		//the ad tags and parameters.
		//but there is a problem with this method in FF 2.0 and this is not
		//mandatory (the document only contains this script), thus we decided to 
		//remove it. 
		//self.document.open("text/html", "replace");
		self.document.write("<scr" + "ipt>var gfEbOnInternalIframe=true;</scr" + "ipt>");	//This will mark that we are in Iframe
	
		if (fIsOOB)
		{		    
		    // replace the ebsafetag tags with a real script tag 
		    strHTML = strHTML.replace(/ebsafetag/g, "script");		    
			self.document.write(strHTML);
		}
		else
		{
			// Declare ad parameters
			eval(strHTML);
			
			// Get the src of the script to load
			var scriptSrc = "";
			
			if(typeof(ebSmallS) != "undefined") // OOB
				scriptSrc = ebSmallS = unescape(ebSmallS);
			else if (typeof(ebSrc) != "undefined") // Single-script Banners
			{
			    // Unescape the paths
			    scriptSrc = ebSrc = unescape(ebSrc);
			    ebResourcePath = unescape(ebResourcePath);
			    
			    // Load the preload (custom) scripts since we're going to load the main script now
			    ebPreloadScripts();
			}
			else if(typeof(ebBSmallS) != "undefined") // Old banners
				scriptSrc = ebBSmallS = unescape(ebBSmallS);

            // Add the script
            if (scriptSrc != "")
			    document.write("<scr" + "ipt src='" + scriptSrc + "'></scr" + "ipt>");
		}
		self.document.close();
	}
	catch(e){}
}

function validateDisplayPos(strPos)
{
    strPos = strPos.replace(/(gstrEbDisplayPos|parent|top|self|window|\.|=| |\"|\')/gi, ""); 
    return (strPos.length == 0);
}

function ebStartAddineyeFlow()
{
    strHTML = "";
	fIsOOB = true;
	var strSearch = document.location.search;

	//	Looking for OOB code
	var myHTMLpos = strSearch.indexOf("strHTML");
	if (myHTMLpos != -1)
	{
		//	OOB code
		myHTMLpos += 8;
		strHTML = strSearch.substr(myHTMLpos);
	}
	else
	{
		//	Banner code
		fIsOOB = false;
		myHTMLpos = strSearch.indexOf("strBanner");
		myHTMLpos += 10;
		strHTML = strSearch.substr(myHTMLpos);
	}

	strHTML = unescape(strHTML);
	var nDPIndex = strHTML.indexOf("gstrEbDisplayPos");
	if(nDPIndex != -1)
	{
	    nDPEndIndex = strHTML.indexOf(";",nDPIndex);
	    strEbDP = strHTML.substr(nDPIndex,nDPEndIndex-nDPIndex);

	    //verify that doesn't contain anything but:
	    //window, self, parent, top and .
	    if (validateDisplayPos(strEbDP))
	        eval(strEbDP);
	}	

	if (typeof(gstrEbDisplayPos) != "undefined")
		pos = "parent." + gstrEbDisplayPos;

    //the following code handles cases where the display page contains "document.domain"
	//IE5.0 doesn't fail on reaching the display page document.domain, but later on the 
	//process we get a javascript error, though the ad was running.
	//we have here a special treatment for IE5.0
	//	if the domain of the addineye is different then the display page's domain,
	//	we set the main page domain to the addineye domain.
	//for other browsers we call setDomain that try to set the domain of the addineye
	//in a loop from the current domain. to all super domains until it contains 2 parts or 
	//until it matches the display page domain (trying to reach the pos.document.domain).
    var fSameDomain = false;
	eval("try{fSameDomain = (document.domain == "+pos + ".document.domain);}catch(e){fSameDomain = false;}");	
	
	if(!fSameDomain)
		eval("try{document.domain = "+pos + ".document.domain;fSameDomain = true;}catch(e){fSameDomain = setDomain();}");       
    
    //Check the addineyeV2.html was called directly - This can cause security problems
    //The addineyeV2.html should be called only from the same domain and the same window
    var fSameWindow = false;
    eval("try{fSameWindow = (" + pos + " == window)}catch(e){}");
        

    //from security reason, we only write the tags into the addineye page in case that
    //the addinEye is from the same domain as the display page.
    //this is done in order to prevent hackers from using the addinEye for malicious purpose.    
	if (fSameDomain && !fSameWindow)
	{
	    try
	    {   
	        // change the out iframe window name - for IE we'll use it to identify that addineye.html was
	        // not loaded and show the default banner instead.
	        window.parent.name = "ebOuterIframe";
	    }
	    catch(e) {}
	    ebWriteTags();
	}
}

//  ==================
//	ebPreloadScripts()
//	==================
//  Preload the script(s) specified in gstrEbPreLoadScripts - used for 
//  single-script banners (new tags)
function ebPreloadScripts()
{
	if ((typeof(gstrEbPreLoadScripts) == "undefined") ||
		(gstrEbPreLoadScripts == ""))
		return;
		
	// Split the preloaded scripts	
	var scripts = gstrEbPreLoadScripts.split(";");
	
	for(var i=0;i<scripts.length;i++)
	{
		var scriptURL = scripts[i];
		
		// If the script is just a file name, create a URL
		if (scriptURL.substr(0,4) != "http")
			scriptURL = ebResourcePath + "CustomScripts/" + scriptURL;
		
		// Add the script to the page
		document.write("<SCR"+"IPT src='" + scriptURL + "'></SCR"+"IPT>");
	}
}

ebStartAddineyeFlow();

