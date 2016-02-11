var Animations = (function () {
    var leslie;

    var projectsTitleFinalPositionFromTop = 50;

    function Animations(les) {
        this.leslie = les;
    }

    Animations.prototype.homeAnimations = function () {

        $('.page .pager#home .title .blue').fadeIn(1000);
        $('.page .pager#home .title .other').delay(700).animate({ 'fontSize': this.leslie.getTitleFontSize(10) }, 1000).animate({ 'opacity': 1 }, 1000, function () {
            $('.page .pager#home .help').fadeIn(400).fadeOut(400).fadeIn(400);
        });       
    }

    Animations.prototype.projectsAnimations = function () {
        $(".pager").hide();
        $(".page").css("backgroundColor", "rgba(0,0,5,0.99)");
        $(".pager#projects").stop().fadeIn(1000);
        $('.page .pager#projects .title').delay(1000).animate({ 'top': projectsTitleFinalPositionFromTop }, 700);
    }

    Animations.prototype.commandsAnimations = function () {
        $(".help").css({ "color": "rgba(200,0,0,0.8)" }).fadeOut(500, function () {

            $(".pager").hide();
            $(".page .pager#commands .commandRow").hide();

            $(".page").css("backgroundColor", "rgba(0,0,5,0.99)");
            $(".pager#commands").stop().fadeIn(1000);
            $('.page .pager#commands .title').delay(1000).animate({ 'top': projectsTitleFinalPositionFromTop }, 700, function () {
                var animationTimeout = 200;

                $(".page .pager#commands .commandRow").each(function (i) {
                    $(this).delay(i * animationTimeout).fadeIn(animationTimeout);
                });
            });

        });
    }
    return Animations;
})();