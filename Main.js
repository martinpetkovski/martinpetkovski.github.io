$(document).ready(function(){
	
	var pam = new PamTypewriter('.homeWrapper .itemsWrapper .subtitle');
	var leslie = new Leslie();

	leslie.calculateHomeWrapperDimensions();
	
	$(window).load(function(){
		$('.blue').fadeIn(1000);
		$('.other').delay(700).animate({'fontSize':120}, 1000).animate({'opacity': 1}, 1000);
		$('.contact').delay(2700).fadeIn(500);

		pam.startTypewriting();
		pam.fixFocus();
	});
});
