function randomIntInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function animateOpacity(element)
{
  /*  
    $(element + " .sectionSubtitle").css({opacity: 0});
    $(element + " .sectionTitle").css({opacity: 0});

    $(element + " .sectionTitle").animate({
        opacity: 1
    }, 500, 'easeInOutBounce', function() {
        $(element + " .sectionSubtitle").animate({
            opacity: 1
        }, 500, 'easeInOutBounce', function(){
            $(element + " .sectionText").animate({
                opacity: 1
            }, 500, 'easeInOutBounce', function(){
                animateProgressBars();
            })
        });
    });*/
    $(element + " .sectionTitle").css({opacity: 0});
    $(element + " .sectionText").css({opacity: 0});
    $(element + " .sectionSubtitle").css({opacity: 0});

    animateSection(element, ".sectionTitle", 500, function(){
    });
    animateSection(element, ".sectionSubtitle", 200, function() {   
    });
    animateSection(element, ".sectionText", 1000, function() {
    }); 
    setTimeout(animateProgressBars, 400);
    
}

function animateSection(element, selector, time,callback, options)
{
    $(element + " " + selector).animate({
        opacity: 1
    }, time, 'easeInOutQuad', function() {
        callback(options);
    });
}

function animateProgressBarWidth(progressBar, finalWidth, time) {
    $(progressBar).animate({ width: finalWidth }, time, 'easeOutExpo');
}

function animateProgressBars()
{
    $(".progressBarFill").each(function(index){
        var temp_width = $(this).attr("level") + "%";
        var temp_index = index;
        $(this).css({width: 0});

       setTimeout(animateProgressBarWidth, temp_index*100, $(this), temp_width,  randomIntInRange(500, 1500));
    });
}