$(document).ready(function(){
	
	var pam = new PamTypewriter('.homeWrapper .itemsWrapper .subtitle');
	var leslie = new Leslie();
	var tom = new TomScroller();
	
	leslie.appendSkills();
	leslie.calculateHomeWrapperDimensions();
	leslie.setTitleColors();
	
	$(window).load(function(){
		$('.blue').fadeIn(1000);
		$('.other').delay(700).animate({'fontSize':100}, 1000, 'easeInOutCubic').animate({'opacity': 1}, 1000);

		pam.startTypewriting();
		pam.fixFocus();

		$(window).scroll(function(){
			pam.stopIfTransparent();

			tom.setHeight();
			tom.setScroll();
			tom.paralax();
			tom.setTitleOpacity();		

			tom.animateSkillBars();
	
		});
	});
});
