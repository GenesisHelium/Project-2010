# Forum

The forum is a static copy of the 2010 pages. There is no database behind it. Categories,
threads and posts are HTML in this folder, so adding content means editing a page.

## Where things are

`Default.aspx` is the index. `ShowForum.aspx` lists the threads in a forum,
`ShowForumGroup.aspx` lists the forums in a category, and each
`ShowPost-PostID*.aspx.html` is one thread page. The skin is in `skins/default/`.

Most pages also exist without the `.aspx` extension. Those are separate files. Edit the one you link to, or change both.

## Adding a forum

Open `Default.aspx` and find the table with `class="tableBorder"`. Leave the header row alone and add rows below it.

A category is one row with `forumHeaderBackgroundAlternate` across five columns. A forum
underneath uses five cells: an icon, the name and description, thread count, post count,
and the last post. Copy an existing row or use this one:

```html
<tr>
    <td class="forumRow" align="center" valign="top" width="34">
        <img src="/p/Forum/skins/default/images/forum_status.gif" width="34" border="0">
    </td>
    <td class="forumRow" width="80%">
        <a class="forumTitle" href="/p/Forum/ShowForum.aspx">General Discussion</a>
        <span class="normalTextSmall">
            <br>Talk about anything ROBLOX.
        </span>
    </td>
    <td class="forumRowHighlight" align="center"><span class="normalTextSmaller">0</span></td>
    <td class="forumRowHighlight" align="center"><span class="normalTextSmaller">0</span></td>
    <td class="forumRowHighlight" align="left">
        <span class="normalTextSmaller">No posts yet</span>
    </td>
</tr>
```

The ids in the archived rows are only labels. Nothing reads them. If you copy a row, change
the id or remove it. The classes do the styling, so leave those in place.

## Adding a thread

Open `ShowForum.aspx` and find the thread table. Its header row stays. Add thread rows below it:

```html
<tr>
    <td class="forumRow" align="center" valign="middle" width="25">
        <a href="/p/Forum/ShowPost-PostID00000000.aspx.html">
            <img title="Post" src="/p/Forum/skins/default/images/icon_mini_topic.gif" border="0"></a>
    </td>
    <td class="forumRow" height="30">
        <a class="forumTitle" href="/p/Forum/ShowPost-PostID00000000.aspx.html">Thread title</a>
        <span class="normalTextSmaller">
            by <a href="/p/Forum/User/UserProfile.aspx">Username</a>
        </span>
    </td>
    <td class="forumRowHighlight" align="center"><span class="normalTextSmaller">0</span></td>
    <td class="forumRowHighlight" align="center"><span class="normalTextSmaller">0</span></td>
    <td class="forumRowHighlight" align="left">
        <span class="normalTextSmaller">Just now</span>
    </td>
</tr>
```

Only two row icons survived the capture: `forum_status.gif` and `icon_mini_topic.gif`. The
other names in the old markup point at files that do not exist. Use one of those two, or add
your own image to `skins/default/images/`.

## Adding a post

Copy an existing `ShowPost-PostID*.aspx.html`, give it the name you link to, and replace the
post body. Keep the page shell, since the header, navigation and footer are what make it look
like the rest of the site. The body sits in a table like this:

```html
<table class="tableBorder" cellspacing="1" cellpadding="3" width="100%">
    <tr>
        <td class="forumRow" valign="top">Post text goes here.</td>
    </tr>
</table>
```

## CSS and JavaScript

Forum-only styles are in `skins/default/style/default.css`. Change that for row colours, title
weight and icon spacing. Site-wide styles are in `site/css/allcss.css`. The skin loads after
the shared sheet, so it overrides it.

There is no forum-specific JavaScript. The pages use the shared jQuery build in `site/js`,
loaded with normal script tags. If you add behaviour, put it there and link it the same way
instead of writing it inline.

## Running the reset again

`tools/reset-content.mjs` is what emptied these pages. It finds the table, keeps the header
row, and removes the rest. Running it again will delete any rows you added, so run it with
`--dry` first or add content after the reset.
