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
        pseudoLink = '<a href="psevdokod.html#%">Псевдокод</a></div>';
    else if (env === 1)
        pseudoLink = '<a href=".#%">Решение</a></div>';

    $.getJSON("data/exercises.json", function (json) {
        var exercises = json.exercises;
        exercises.sort(compareDates);
        exercises.forEach(function (exs) {
            if (exs.title.toLowerCase().indexOf(query.toLowerCase()) != -1 || exs.meta.toLowerCase().indexOf(query.toLowerCase()) != -1 || exs.date.toLowerCase().indexOf(query.toLowerCase()) != -1) {
                $.ajax({
                    url: "data/cpp/" + exs.id + extension,
                    dataType: "text",
                    success: function (cpp) {
                        cpp = cpp.replace("<", "&lt;");
                        cpp = cpp.replace(">", "&gt;");
                        $('#mainContent').append('<div class="section" id="'+exs.id+'"><div id="title">' + exs.title + '</div><div id="meta">' + exs.meta + " " + pseudoLink.replace("%", exs.id) +' <pre class="brush: cpp; toolbar: false;">' + cpp + '</pre></div><hr/>');
                        SyntaxHighlighter.highlight();
                        scrollToAnchor();
                    }
                });
            }
        });
    });
}

$(document).ready(function () {
    
    if (env === 0) {
        printExercises("", ".cpp");

        $("#search input").keyup(function (e) {
            printExercises($(this).val(), ".cpp");
        });
    }

    if (env === 1) {
        printExercises("", ".pseudo");

        $("#search input").keyup(function (e) {
            printExercises($(this).val(), ".pseudo");
        });
    }
});