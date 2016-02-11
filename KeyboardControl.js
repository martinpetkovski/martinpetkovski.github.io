function gainKeyboardControl(anim) {

    $(window).bind('keypress', function (e) {
        
        if (e.which == "h".charCodeAt(0)) {
            $(".help").css({ "color": "rgba(255,255,255,0.8)" });
            $(".help").show();

            $(".pager").hide();
            $(".pager#home").stop().fadeIn(500);
            $(".page").css("backgroundColor", "rgba(0,5,15,0.95)");
            anim.leslie.update();
        }

        if (e.which == "t".charCodeAt(0)) {
            anim.leslie.update();
            anim.projectsAnimations();
        }

        if (e.which == "c".charCodeAt(0)) {
            anim.leslie.update();
            anim.commandsAnimations();
        }
    });
}