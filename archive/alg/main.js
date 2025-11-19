function refreshTaskList(filter) {
    fetch('tasks.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(taskData => {
            const taskListContainer = document.getElementById("taskList");
            taskListContainer.innerHTML = "";
            const tasksByTopic = {};

            taskData.tasks.forEach((task, index) => {
                if (filter.length === 0 || task.title.toLowerCase().includes(filter.toLowerCase())) {
                    if (!tasksByTopic[task.topic]) {
                        tasksByTopic[task.topic] = [];
                    }
                    tasksByTopic[task.topic].push({
                        title: task.title,
                        difficulty: task.difficulty,
                        type: task.type,
                        link: `task.html?t=${index}`
                    });
                }
            });

            for (const topic in tasksByTopic) {
                const topicSection = document.createElement("section");
                const topicHeading = document.createElement("h2");
                topicHeading.textContent = topic;
                topicSection.appendChild(topicHeading);

                const taskList = document.createElement("table");

                tasksByTopic[topic].forEach((task) => {
                    const taskLink = document.createElement("a");
                    const taskRow = document.createElement("tr");
                    const taskTitle = document.createElement("td");
                    const taskDifficulty = document.createElement("td");
                    const taskDifficultyElement = document.createElement("div");
                    const type = document.createElement("td");

                    if (task.type === "Текст") {
                        taskRow.classList.add("task");
                    }

                    taskLink.href = task.link;
                    taskLink.textContent = `${task.title}`;
                    taskDifficultyElement.setAttribute("data-value", `${task.difficulty}`);
                    taskDifficultyElement.classList.add("progressBar");
                    type.textContent = `${task.type}`;

                    taskList.appendChild(taskRow);
                    taskRow.appendChild(taskTitle);
                    taskTitle.appendChild(taskLink);
                    taskRow.appendChild(taskDifficulty);
                    taskDifficulty.appendChild(taskDifficultyElement);
                    taskRow.appendChild(type);
                });

                topicSection.appendChild(taskList);
                taskListContainer.appendChild(topicSection);
            }

            const progressBars = document.querySelectorAll('.progressBar');
            progressBars.forEach(bar => {
                const value = bar.getAttribute('data-value');
                const progress = document.createElement('div');
                progress.classList.add('progress');
                progress.style.width = value + '%';
                progress.style.backgroundColor = interpolateColor(value);
                bar.appendChild(progress);
            });
        })
        .catch(error => {
            console.error('There was a problem with fetching the JSON data:', error);
        });
}

function filterTasks() {
    var searchTasks = document.querySelector("#searchTasks");
    refreshTaskList(searchTasks.value);
}

document.addEventListener("DOMContentLoaded", function () {
    refreshTaskList("");
});