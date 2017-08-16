function loadContent(selector,pageURL) {
    var LSelector = selector;
    $(LSelector).load(pageURL, function(){
        animateOpacity(LSelector);
    });
}

function changeCurrentPage(destination, page) {
    loadContent(destination, "pages/"+page+".html");
}

$(document).ready( function() {
    loadContent("header", "includes/header.html");
    loadContent("main", "pages/skillset.html");
    loadContent("skillsetMain", "pages/skillset/programming.html")
    loadContent("footer", "includes/footer.html");
});