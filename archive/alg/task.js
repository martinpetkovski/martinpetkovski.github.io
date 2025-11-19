function escapeHtml(str) {
    return str.replace(/[&<>"'\/]/g, function (match) {
        const entities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
            '/': '&#47;'
        };
        return entities[match];
    });
}

document.addEventListener("DOMContentLoaded", function () {
    fetch('tasks.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(taskData => {

            var main = document.querySelector("main");
            main.style.display = "block";

            const url = window.location.href;
            const urlParams = new URLSearchParams(window.location.search);
            const paramValue = urlParams.get('t');

            if (paramValue in taskData.tasks) {
                const task = taskData.tasks[paramValue];
                const titleElement = document.querySelector("#title");
                const linkElement = document.querySelector("#externalLink");
                titleElement.textContent = task.title;
                linkElement.href = task.externalLink;

                const difficultyElement = document.querySelector(".progressBar");
                const progress = document.createElement('div');
                progress.classList.add('progress'); 
                progress.style.width = task.difficulty + '%';
                progress.style.backgroundColor = interpolateColor(task.difficulty);
                difficultyElement.appendChild(progress);

                const descriptionElement = document.querySelector("#description");
                descriptionElement.innerHTML = task.description.replace(/\n/g, '<br>');

                const inputElement = document.querySelector("#input");
                inputElement.innerHTML = task.input.replace(/\n/g, '<br>');

                const outputElement = document.querySelector("#output");
                outputElement.innerHTML = task.output.replace(/\n/g, '<br>');

                const limitationsElement = document.querySelector("#limitations");
                limitationsElement.innerHTML = `<p><i class="fa fa-clock"></i> ${task.limitations.time} <i class="fa fa-memory"></i> ${task.limitations.memory}</p>`;

                const examplesElement = document.querySelector(".examples table");
                task.examples.forEach(example => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
            <td>${example.input.replace(/\n/g, '<br>')}</td>
            <td>${example.output.replace(/\n/g, '<br>')}</td>
        `;
                    examplesElement.appendChild(row);
                });

                const solutionElement = document.querySelector(".cpp");

                fetch(task.solution)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return response.text();
                    })
                    .then(data => {
                        solutionElement.innerHTML = escapeHtml(data);
                        hljs.highlightAll();
                    })
                    .catch(error => {
                        console.error('There was a problem with the fetch operation:', error);
                    });

                const explanationElement = document.querySelector("#explanation");
                explanationElement.textContent = task.explanation;
            }
            else // task does not exist
            {
                main.style.display = "none";
            }
        })
        .catch(error => {
            console.error('There was a problem with fetching the JSON data:', error);
        });

});