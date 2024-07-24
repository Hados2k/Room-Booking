const availableRooms = [
    "G.01", "G.02", "G.03", "G.04", "G.05", "G.07",
    "L1.01", "L1.02",
    "LG.01", "LG.02", "LG.03", "LG.04", "LG.05", "LG.06", "LG.07", "LG.08", "LG.09", "LG.10"
];

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const timeSlots = generateTimeSlots("08:00 AM", "09:00 PM");

document.addEventListener('DOMContentLoaded', loadTableData);

function generateTimeSlots(startTime, endTime) {
    const slots = [];
    const start = moment(startTime, "hh:mm A");
    const end = moment(endTime, "hh:mm A");

    while (start < end) {
        slots.push(start.format("hh:mm A"));
        start.add(30, 'minutes');
    }
    // Ensure the last entry has individual cells
    if (slots[slots.length - 1] !== end.format("hh:mm A")) {
        slots.push(end.format("hh:mm A"));
    }

    return slots;
}

function handleFileUpload(event, weekIndex) {
    const image = event.target.files[0];
    if (!image) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const photoURL = e.target.result;
        addPhotoToDropdown(photoURL, weekIndex);
        saveTableData(); // Save immediately after adding the photo

        Tesseract.recognize(
            image,
            'eng',
            {
                logger: m => console.log(m)
            }
        ).then(({ data: { text } }) => {
            const bookingInfo = parseBookingText(text);
            populateTable(bookingInfo, weekIndex);
            saveTableData();
        }).catch(error => {
            console.error(error);
        });
    };
    reader.readAsDataURL(image);
}

function parseBookingText(text) {
    let room = null;
    for (let i = 0; i < availableRooms.length; i++) {
        const roomPattern = new RegExp(`\\b${availableRooms[i]}\\b`, 'i');
        if (roomPattern.test(text)) {
            room = availableRooms[i];
            break;
        }
    }

    const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]m)\s*-\s*(\d{1,2}:\d{2}\s*[ap]m)/i);
    const dateMatch = text.match(/(\w+),\s+(\w+\s+\d{1,2},\s+\d{4})/i);

    const startTime = timeMatch ? timeMatch[1] : null;
    const endTime = timeMatch ? timeMatch[2] : null;
    const date = dateMatch ? dateMatch[2] : null;
    const dayOfWeek = dateMatch ? dateMatch[1] : null;

    return { room, startTime, endTime, date, dayOfWeek };
}

function populateTable(info, weekIndex) {
    const tableBody = document.querySelector(`#week${weekIndex} .tableBody`);

    if (!tableBody.rows.length) {
        daysOfWeek.forEach(day => {
            const row = tableBody.insertRow();
            const dayCell = row.insertCell();
            dayCell.innerText = day;
            dayCell.style.backgroundColor = 'white'; // White background for day headers
            for (let i = 0; i < timeSlots.length; i++) {
                const cell = row.insertCell();
                cell.style.width = '50px';
                cell.style.height = '50px';
            }
        });
    }

    const dayIndex = daysOfWeek.indexOf(info.dayOfWeek);

    if (dayIndex === -1 || !info.startTime || !info.endTime) {
        alert("Could not find a valid booking in the provided image.");
        return;
    }

    const startIndex = timeSlots.indexOf(moment(info.startTime, "hh:mm A").format("hh:mm A"));
    const endIndex = timeSlots.indexOf(moment(info.endTime, "hh:mm A").subtract(30, 'minutes').format("hh:mm A"));

    if (startIndex === -1 || endIndex === -1) {
        alert("Invalid time slot in the booking information.");
        return;
    }

    for (let i = startIndex; i <= endIndex; i++) {
        const cell = tableBody.rows[dayIndex].cells[i + 1];
        cell.style.backgroundColor = "lime";
        cell.innerHTML = `<strong>${info.room}</strong> <button onclick="removeBooking(this)">Delete</button>`;
    }
}

function removeBooking(button) {
    const cell = button.parentElement;
    cell.innerHTML = "";
    cell.style.backgroundColor = "";
    cell.style.width = '50px';
    cell.style.height = '50px';
    saveTableData();
}

function saveTableData() {
    const weeks = document.querySelectorAll('.week-container');
    const tableData = [];

    weeks.forEach((week, index) => {
        const tableBody = week.querySelector('.tableBody');
        const photoDropdown = week.querySelector(`#photoDropdown${index + 1}`);
        const photos = Array.from(photoDropdown.getElementsByTagName('img')).map(img => img.src);
        const weekData = {
            weekNumber: index + 1,
            rows: [],
            photos: photos
        };

        for (let i = 0; i < tableBody.rows.length; i++) {
            const row = tableBody.rows[i];
            const rowData = [];
            for (let j = 0; j < row.cells.length; j++) {
                rowData.push({
                    content: row.cells[j].innerHTML,
                    backgroundColor: row.cells[j].style.backgroundColor
                });
            }
            weekData.rows.push(rowData);
        }

        tableData.push(weekData);
    });

    localStorage.setItem('tableData', JSON.stringify(tableData));
}

function loadTableData() {
    const tableData = JSON.parse(localStorage.getItem('tableData'));

    if (tableData) {
        tableData.forEach((weekData, index) => {
            addWeek(false); // Add the week structure without saving
            const tableBody = document.querySelector(`#week${index + 1} .tableBody`);
            const photoDropdown = document.querySelector(`#photoDropdown${index + 1}`);

            weekData.rows.forEach(rowData => {
                const row = tableBody.insertRow();
                rowData.forEach(cellData => {
                    const cell = row.insertCell();
                    cell.innerHTML = cellData.content;
                    cell.style.backgroundColor = cellData.backgroundColor;
                    cell.style.width = '50px';
                    cell.style.height = '50px';
                });
            });

            weekData.photos.forEach(photoURL => {
                addPhotoToDropdown(photoURL, index + 1, false);
            });
        });
    }
}

function clearTableData(weekIndex) {
    const tableBody = document.querySelector(`#week${weekIndex} .tableBody`);
    tableBody.innerHTML = '';
    const photoDropdown = document.querySelector(`#photoDropdown${weekIndex}`);
    photoDropdown.innerHTML = '';
    saveTableData();
}

function deleteWeek(weekIndex) {
    const weekContainer = document.getElementById(`week${weekIndex}`);
    weekContainer.remove();
    saveTableData();
}

function addWeek(save = true) {
    const weeksContainer = document.getElementById('weeksContainer');
    const weekCount = weeksContainer.childElementCount + 1;

    const weekContainer = document.createElement('div');
    weekContainer.className = 'week-container';
    weekContainer.id = `week${weekCount}`;

    weekContainer.innerHTML = `
        <div class="week-header">
            <h2>Week ${weekCount}</h2>
            <button class="delete-week" onclick="deleteWeek(${weekCount})">Delete Week</button>
            <div>
                <input type="file" id="fileUploader${weekCount}" accept="image/*" onchange="handleFileUpload(event, ${weekCount})">
                <button onclick="extractBookingInfo(${weekCount})">Extract Booking Info</button>
                <button onclick="clearTableData(${weekCount})">Clear Data</button>
            </div>
        </div>
        <table id="bookingTable${weekCount}">
            <thead>
                <tr>
                    <th>Day</th>
                    ${timeSlots.map(slot => `<th>${slot}</th>`).join('')}
                </tr>
            </thead>
            <tbody class="tableBody">
                <!-- Table rows will be dynamically populated -->
            </tbody>
        </table>
        <div class="photo-dropdown">
            <button onclick="toggleDropdown(${weekCount})">Show Photos</button>
            <div class="photo-dropdown-content" id="photoDropdown${weekCount}"></div>
        </div>
    `;

    weeksContainer.appendChild(weekContainer);

    if (save) saveTableData();
}

function extractBookingInfo(weekIndex) {
    const fileUploader = document.getElementById(`fileUploader${weekIndex}`);
    handleFileUpload({ target: fileUploader }, weekIndex);
}

function addPhotoToDropdown(photoURL, weekIndex, save = true) {
    const photoDropdownContent = document.getElementById(`photoDropdown${weekIndex}`);
    const imgContainer = document.createElement('div');
    imgContainer.className = 'img-container';
    const img = document.createElement('img');
    img.src = photoURL;
    const deleteButton = document.createElement('button');
    deleteButton.innerText = 'Delete';
    deleteButton.onclick = function () {
        imgContainer.remove();
        saveTableData();
    };
    imgContainer.appendChild(deleteButton);
    imgContainer.appendChild(img);
    photoDropdownContent.appendChild(imgContainer);

    if (save) saveTableData();
}

function toggleDropdown(weekIndex) {
    const photoDropdownContent = document.getElementById(`photoDropdown${weekIndex}`);
    if (photoDropdownContent.classList.contains('show')) {
        photoDropdownContent.classList.remove('show');
    } else {
        photoDropdownContent.classList.add('show');
    }
}
