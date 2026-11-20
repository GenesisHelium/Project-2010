jQuery.extend(jQuery.expr[':'], {
    focus: function(element)
    {
        return element == document.activeElement;
    }
});

