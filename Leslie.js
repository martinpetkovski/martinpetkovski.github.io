var Leslie = (function(){
	function Leslie() {}

	Leslie.prototype.getTitleFontSize = function(additor) {
		var title = $(".homeWrapper .title").html().replace(/(<([^>]+)>)/ig,"");

		return ($(window).width() / title.length) + additor;
	}

	Leslie.prototype.calculateHomeWrapperDimensions = function() {
		var fontSize;
		var halfFontSize;

		if($(window).width() < 1000) {
			$(".link span").stop().css({"fontSize": 0});
			fontSize = this.getTitleFontSize(30);
			halfFontSize = this.getTitleFontSize(30) / 3;
		}
		else {
			$(".link span").stop().css({"fontSize": 16});
			fontSize = this.getTitleFontSize(10);
			halfFontSize = this.getTitleFontSize(10) / 3;
		}

		$(".homeWrapper .title .blue").css({"fontSize": fontSize});
		$(".homeWrapper .subtitle").css({"fontSize": halfFontSize});
		
		var paddingTop = ($(window).height() / 2) - ( parseInt($(".homeWrapper .title").css("fontSize")) / 2) - 80;		
		$(".homeWrapper").css("paddingTop", paddingTop);	
		$(".homeWrapper").css("height", $(window).height() - paddingTop);
	}

	Leslie.prototype.update = function() {
		var fontSize;
		var halfFontSize;

		if($(window).width() < 1000) {
			$(".link span").stop().animate({"fontSize": 0}, 500);
			fontSize = this.getTitleFontSize(30);
			halfFontSize = this.getTitleFontSize(30) / 3;
		}
		else {
			$(".link span").stop().animate({"fontSize": 16}, 500);
			fontSize = this.getTitleFontSize(10);
			halfFontSize = this.getTitleFontSize(10) / 3;
		}

		$(".homeWrapper .title .blue, .homeWrapper .title .other").stop().animate({"fontSize": fontSize}, 500);
		$(".homeWrapper .subtitle").stop().animate({"fontSize": halfFontSize}, 500);

		var paddingTop = ($(window).height() / 2) - ( parseInt($(".homeWrapper .title").css("fontSize")) / 2) - 80;		
		$(".homeWrapper").css("paddingTop", paddingTop);	
		$(".homeWrapper").css("height", $(window).height() - paddingTop);
	}

	Leslie.prototype.resolutionChange = function() {
		var that = this;
		$(window).resize(function() {
			that.update();
		});
	}
	return Leslie;
})();