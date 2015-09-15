$(document).ready(function(){
	
	var pam = new PamTypewriter('.homeWrapper .itemsWrapper .subtitle');
	var leslie = new Leslie();
	
	$(window).load(function(){
		$('.blue').fadeIn(1000);
		$('.other').delay(700).animate({'fontSize':leslie.getTitleFontSize(10)}, 1000).animate({'opacity': 1}, 1000);
		$('.contact').delay(2700).fadeIn(500);

		leslie.calculateHomeWrapperDimensions();

		pam.startTypewriting();
		pam.fixFocus();

		leslie.resolutionChange();
	});
});
