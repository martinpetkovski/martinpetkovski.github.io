var vezhbi_number = 4;
/*
function transliterate(a) {

    a = a.toLowerCase();

    var CyrlicAlphabet = "абвгдѓежзѕијклљмнњопрстќуфхцчџш";
    var LatinAlphabet = ["a", "b", "v", "g", "d", "gj", "e", "zh", "z", "dz", "i", "j", "k", "l", "lj", "m", "n", "nj", "o", "p", "r", "s", "t", "kj", "u", "f", "h", "c", "ch", "dj", "sh"];
    var transliterated = "";
    var i, j;
    var flag;

    for(i=0; i<a.length; i++) {
        for(j=0; j<CyrlicAlphabet.length; j++) {
            if(a[i] === CyrlicAlphabet[j]) {
                transliterated += LatinAlphabet[j];
                flag = false;
                break;
            }
            else if(a[i] === LatinAlphabet[j]) {
                transliterated += CyrlicAlphabet[j];
                flag = false;
                break;
            }
            else
                flag = true;
        }

        if(flag) {
            transliterated += a[i];
        }
    }

    return transliterated;
}*/

function compareDates(a, b) {
    if (a.date < b.date)
        return -1;
    else if (a.date > b.date)
        return 1;
    else {
        if (a.id < b.id)
            return -1;
        else if (a.id > b.id)
            return 1;
        else
            return 0;
    }
}

function scrollToAnchor() {
    if (window.location.hash != '') {
        var anchor = $(location.hash).get(0);
        if (anchor) { anchor.scrollIntoView() }
    }
}

function printExercises(query, extension) {
    $('#mainContent').html("");

    var pseudoLink = "";
    if (env === 0)
        pseudoLink = '<br/><a href="psevdokod.html#%" id="pr-link">Псевдокод</a>';
    else if (env === 1)
        pseudoLink = '<br/><a href=".#%" id="pr-link">Решение</a>';

    var v = false;
    if ($("#search input").val().indexOf("#") !== -1)
        v = true;

    $.getJSON("data/exercises.json", function (json) {
        var exercises = json.exercises;
        exercises.sort(compareDates);
        exercises.forEach(function (exs) {
            if ((((exs.title.toLowerCase().indexOf(query.toLowerCase()) !== -1 || exs.meta.toLowerCase().indexOf(query.toLowerCase()) !== -1 || exs.date.toLowerCase().indexOf(query.toLowerCase()) !== -1) && !v)
                || (exs.vezhbiid.indexOf(query.substr(1)) !== -1 && v))
                && (parseInt(exs.vezhbiid) > 0 && parseInt(exs.vezhbiid) <= vezhbi_number)) {
                $.ajax({
                    async: false,
                    url: "data/cpp/" + exs.id + extension,
                    dataType: "text",
                    success: function (cpp) {
                        cpp = cpp.replace("<", "&lt;");
                        cpp = cpp.replace(">", "&gt;");
                        $('#mainContent').append('<div class="section" id="' + exs.id + '"><div id="title">' + exs.title + '</div><div id="meta">' + exs.meta + '</div> <pre class="brush: cpp; toolbar: false;">' + cpp + '</pre> ' + pseudoLink.replace("%", exs.id) + '</div><hr/>');
                        SyntaxHighlighter.highlight();
                        scrollToAnchor();
                    }
                });
            }
        });
    });
}

$(document).ready(function () {
    $.ajaxSetup({ cache: false });

    $("#search input").focus(function () {
        window.location.hash = '';
    });
    
    if (env === 0) {
        printExercises("", ".cpp");

        $("#search input").keyup(function (e) {
            if(e.which == 13 || e.which == 32 || e.which == 0)
                printExercises($(this).val(), ".cpp");
        });
    }

    if (env === 1) {
        printExercises("", ".pseudo");

        $("#search input").keyup(function (e) {
            if(e.which == 13 || e.which == 32 || e.which == 0)
                printExercises($(this).val(), ".pseudo");
        });
    }
});