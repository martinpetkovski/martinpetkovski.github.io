var Skill = (function(){
	var name;
	var time;
	var active;
	var evaluation;
	var start;
	var d;
	
	function Skill(name, time, evaluation, active) {
		this.name = name;
		this.d = (new Date()).getTime() / 1000;
		this.start = this.d - 1251763199;
		this.time = this.d - time;
		this.active = active;
		this.evaluation = evaluation;
	}
	
	Skill.prototype.getName = function() {
		return this.name;
	}
	
	Skill.prototype.getPercentage = function() {
		return ((this.time / this.start) * 100);
	}
	
	return Skill;
})();