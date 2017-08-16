$(document).ready(function(){
    loadReviews("");
});

$("#reviewsSearch").keyup(function(){
    loadReviews($("#reviewsSearch").val());
});

function stringSimilarity(s1, s2) {
  var longer = s1;
  var shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  var longerLength = longer.length;
  if (longerLength == 0) {
    return 1.0;
  }
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();

  var costs = new Array();
  for (var i = 0; i <= s1.length; i++) {
    var lastValue = i;
    for (var j = 0; j <= s2.length; j++) {
      if (i == 0)
        costs[j] = j;
      else {
        if (j > 0) {
          var newValue = costs[j - 1];
          if (s1.charAt(i - 1) != s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue),
              costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0)
      costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}
    
function loadReviews(similarTo)
{
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", "data/reviews.json", true);
    xmlhttp.send(); 

    xmlhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            root = JSON.parse(this.responseText);
            $(".sectionText#reviews").html("");
            for(i=root.reviews.length-1; i>=0; i--) {
                if(root.reviews[i].title.toLowerCase().indexOf(similarTo.toLowerCase()) >= 0 || similarTo === "")
                {
                    $(".sectionText#reviews").append(
                    '<div class="review">'+
                        '<div class="progressBarBorder" id="review">'+
                            '<div class="progressBarFill" level="'+root.reviews[i].rating+'">' +
                                '<div class="reviewTitle">'+root.reviews[i].title+'</div>'+
                                '<div class="reviewType">'+root.reviews[i].type+'</div>'+
                                '<div class="reviewText">'+root.reviews[i].description+'</div>'+
                            '</div>'+
                        '</div>'+
                    '</div>'
                    )
                }
            }

            animateProgressBars();
        }
    };
}