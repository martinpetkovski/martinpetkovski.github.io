var Leslie = (function(){
	function Leslie() {}

	Leslie.prototype.getTitleFontSize = function(additor) {
		var title = $(".page .title").html().replace(/(<([^>]+)>)/ig,"");

		return ($(window).width() / title.length) + additor;
	}

	Leslie.prototype.calculatePageDimensions = function() {
		var fontSize;
		var halfFontSize;

		if($(window).width() < 1000) {
			fontSize = this.getTitleFontSize(30);
			halfFontSize = this.getTitleFontSize(30) / 3;
		}
		else {
			fontSize = this.getTitleFontSize(10);
			halfFontSize = this.getTitleFontSize(10) / 3;
		}

		$(".page .title .blue").css({"fontSize": fontSize});
		$(".page .subtitle").css({"fontSize": halfFontSize});
		
		var marginTop = ($(window).height() / 2) - ( parseInt($(".page .title").css("fontSize")) / 2) - 80;		
		$(".pager#home .title").css("marginTop", marginTop);	
		$(".page").css("height", $(window).height());
	}

	Leslie.prototype.update = function() {
		var fontSize;
		var halfFontSize;

		if($(window).width() < 1000) {
			fontSize = this.getTitleFontSize(30);
			halfFontSize = this.getTitleFontSize(30) / 3;
		}
		else {
			fontSize = this.getTitleFontSize(10);
			halfFontSize = this.getTitleFontSize(10) / 3;
		}

		$(".page .title .blue, .page .title .other").stop().animate({"fontSize": fontSize}, 500);
		$(".page .subtitle").stop().animate({"fontSize": halfFontSize}, 500);

		var marginTop = ($(window).height() / 2) - (parseInt($(".pager#home .title").css("fontSize")) / 2) - 80;
		marginTop = Math.round(marginTop);
		$(".pager#home .title").css("marginTop", marginTop);
		$(".pager:not(#home) .title").css("top", marginTop);
		$(".page").css("height", $(window).height());
	}

	Leslie.prototype.resolutionChange = function() {
		var that = this;
		$(window).resize(function() {
			that.update();
		});
	}
	return Leslie;
})();