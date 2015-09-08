var TomScroller = (function(){

	var height;
	var scroll;
	var scrollCoef;
	var trueScrollCoef;

	function TomScroller() {}

	TomScroller.prototype.setHeight = function() {
		this.height = $(document).height() - $(window).height();
	}

	TomScroller.prototype.setScroll = function() {
		if($('.infoWrapper').offset().top - $(window).scrollTop() - $(window).height() - 100 < 0) {
			this.scroll = $(document).height() - $(document).scrollTop() + 150;		
		}
		else {
			this.scroll = $(window).scrollTop();		
		}

		this.scrollCoef = this.scroll / this.height;
		this.trueScrollCoef = this.scroll / $(window).height();
	}

	TomScroller.prototype.paralax = function() {
		var pos = this.scrollCoef * 3000;
		$('body').css('backgroundPosition', '0px ' + pos + 'px' );
	}

	TomScroller.prototype.setTitleOpacity = function() {
		$('.homeWrapper').css({'opacity': 1 - this.trueScrollCoef});
		$('.homeWrapper .itemsWrapper .title').css({'opacity': 1 - this.trueScrollCoef * 3});
		$('.homeWrapper .itemsWrapper .subtitle').css({'opacity': 1 - this.trueScrollCoef * 2});
	}

	TomScroller.prototype.getPercentage = function(id) {
		var byTimeSpent = skills[id].getPercentage();
		var byEvaluation = skills[id].evaluation;
		
		return ((byTimeSpent + byEvaluation) / 2);
	}

	TomScroller.prototype.animateSkillBars = function() {
		var iterator = 0;
		var that = this;
			
		$('.itemBox .skill').each(function(){
			
			var offset = $(this).offset().top;
			
			if(offset < (that.scroll + $(window).height())) {
				var width = Math.round(that.getPercentage(iterator));
				$(this).find('.filledBar').delay(500).animate({'width': width + '%'}, 1000);
				if (skills[iterator].active === false) {
					$(this).find('.filledBar').animate({'backgroundColor': '#CC0'}, 500);
				}
			}
			iterator++;
		});
	}

	return TomScroller;
})();