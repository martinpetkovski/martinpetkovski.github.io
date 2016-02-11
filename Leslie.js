var Leslie = (function () {

    var marginTop;

    function Leslie() { }

    Leslie.prototype.getMarginTop = function() {
        return ($(window).height() / 2) - (parseInt($(".pager .title").css("fontSize")) / 2) - 80;
    }

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
		
		this.marginTop = ($(window).height() / 2) - ( parseInt($(".pager .title").css("fontSize")) / 2) - 80;		
		$(".pager#home .title").css("marginTop", this.marginTop);	
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

		this.marginTop = ($(window).height() / 2) - (parseInt($(".pager .title").css("fontSize")) / 2) - 80;
		this.marginTop = Math.round(this.marginTop);
		$(".pager#home .title").css("marginTop", this.marginTop);
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