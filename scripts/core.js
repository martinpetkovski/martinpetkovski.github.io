$.ajaxSetup ({
    cache: false
});

var player;
function onYouTubePlayerAPIReady() {
    player = new YT.Player('youTubeVideo', {
        playerVars: {
            'mute': 1
        },

        events: {
            'onReady': onPlayerReady
        }
    });
}
function onPlayerReady(event) {
    event.target.mute();
}

$(document).ready(function(){
    $(document).on("click", ".navigationItem", function(event){
        var currentPage = $(this).attr("goto");
        var destination = $(this).attr("dest");
        changeCurrentPage(destination, currentPage);
    });
});