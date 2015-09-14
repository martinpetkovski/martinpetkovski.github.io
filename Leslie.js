root = '/martinpetkovski.net';

var Leslie = (function(){
	function Leslie() {}

	Leslie.prototype.calculateHomeWrapperDimensions = function() {
		var paddingTop = ($(window).height() / 2) - ( parseInt($(".homeWrapper .title").css("fontSize")) / 2);		
		$(".homeWrapper").css("paddingTop", paddingTop);	
		$(".homeWrapper").css('height', $(window).height() - paddingTop);
	}
	return Leslie;
})();