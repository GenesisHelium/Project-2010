var _____WB$wombat$assign$function_____=function(name){return (globalThis._wb_wombat && globalThis._wb_wombat.local_init && globalThis._wb_wombat.local_init(name))||globalThis[name];};if(!globalThis.__WB_pmw){globalThis.__WB_pmw=function(obj){this.__WB_source=obj;return this;}}{
let window = _____WB$wombat$assign$function_____("window");
let self = _____WB$wombat$assign$function_____("self");
let document = _____WB$wombat$assign$function_____("document");
let location = _____WB$wombat$assign$function_____("location");
let top = _____WB$wombat$assign$function_____("top");
let parent = _____WB$wombat$assign$function_____("parent");
let frames = _____WB$wombat$assign$function_____("frames");
let opener = _____WB$wombat$assign$function_____("opener");
;/// files: CharacterSelect.js

;/// CharacterSelect.js
typeof Roblox=="undefined"&&(Roblox={}),Roblox.CharacterSelect=function(){function o(){return n.genderID=t.male,i(1,"Male",t.male),!1}function e(){return n.genderID=t.female,i(0,"Female",t.female),!1}function i(t,i,r){$.modal.close(".GuestModePromptModal"),$(function(){RobloxEventManager.triggerEvent("rbx_evt_generic",{type:"CharacterSelectClick"})}),n.robloxLaunchFunction(r)}function f(n){for(var i=$(n),t=0;t<i.length;t++)i[t]!=undefined&&(i[t].getAttribute("src")==undefined||i[t].getAttribute("src")=="")&&i[t].setAttribute("src",i[t].getAttribute("delaysrc"))}function s(){f(".GuestPlayAvatarImage, .ABGuestPlayAvatarImage"),$("#GuestModePrompt_BoyGirl").modal({overlayClose:!0,escClose:!0,opacity:80,overlayCss:{backgroundColor:"#000"},onShow:r})}function r(n){if(n.container.innerHeight()==15){var t=-Math.floor($("#GuestModePrompt_BoyGirl").innerHeight()/2);$("#GuestModePrompt_BoyGirl").css({position:"relative",top:t+"px"})}}function u(){$.modal.close(".GuestModePromptModal")}var t={male:2,female:3},n;return $(function(){$(".CharacterSelect").live("click",function(){RobloxEventManager.triggerEvent("rbx_evt_popup_action",{action:"Character Select"})}),$(".HaveAccount").live("click",function(){RobloxEventManager.triggerEvent("rbx_evt_popup_action",{action:"Login"})}),$(".VisitButtonGirlGuest").click(e),$(".VisitButtonBoyGuest").click(o)}),n={robloxLaunchFunction:function(){},genderID:null,show:s,hide:u,placeid:undefined}}();

}

/*
     FILE ARCHIVED ON 20:57:14 Jun 05, 2012 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 16:47:43 Nov 19, 2026.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  captures_list: 0.635
  exclusion.robots: 0.095
  exclusion.robots.policy: 0.081
  esindex: 0.01
  cdx.remote: 13.308
  LoadShardBlock: 402.323 (3)
  PetaboxLoader3.resolve: 184.991 (4)
  PetaboxLoader3.datanode: 177.956 (4)
  load_resource: 133.386
*/