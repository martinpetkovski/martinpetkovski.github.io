$.ajaxSetup ({
    cache: false
});

$('<img/>').attr('src', 'resources/background_filter.png').on('load', function() {
   $(this).remove(); // prevent memory leaks
   $('body').css({'background-color': '#00FF66'});
});

$(document).ready(function(){
    $(document).on("click", ".navigationItem", function(event){
        var currentPage = $(this).attr("goto");
        var destination = $(this).attr("dest");
        changeCurrentPage(destination, currentPage);
    });
});