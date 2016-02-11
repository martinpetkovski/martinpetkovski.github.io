$(document).ready(function(){
    projectsTitleFinalPositionFromTop = 50;

	var pam = new PamTypewriter('.page .pager#home .subtitle');
	var leslie = new Leslie();
	var animations = new Animations(leslie);

	leslie.calculatePageDimensions();
	
	$(window).load(function () {
	    animations.homeAnimations();

		gainKeyboardControl(animations);

		pam.startTypewriting();
		pam.fixFocus();

		leslie.resolutionChange();
	});
});
