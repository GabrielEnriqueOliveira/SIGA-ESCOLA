document.addEventListener('DOMContentLoaded', () => {
  const toastContainer = document.getElementById('toast-container');

  const navItems = document.querySelectorAll('.nav-item[data-page]');
  const pageSections = document.querySelectorAll('.page');
  const clockEl = document.getElementById('clock');

  const studentForm = document.getElementById('student-form');
  const studentsTableBody = document.querySelector('#students-table tbody');
  const seriesFilter = document.getElementById('series-filter');
  const roomFilter = document.getElementById('room-filter');
  const roomSelect = document.getElementById('room-select');
  const refreshStudentsButton = document.getElementById('refresh-students');
  const openAddStudent = document.getElementById('open-add-student');
  const addStudentPanel = document.getElementById('add-student-panel');
  const cancelAddStudent = document.getElementById('cancel-add-student');

  const attendanceDateInput = document.getElementById('attendance-date');
  const attendanceRoomFilter = document.getElementById('attendance-room-filter');
  const attendanceTableBody = document.querySelector('#attendance-table tbody');
  const saveAllAttendanceButton = document.getElementById('save-all-attendance');
  const attendanceActions = document.getElementById('attendance-actions');

  const callsDateInput = document.getElementById('calls-date');
  const loadCallsButton = document.getElementById('load-calls');
  const callsList = document.getElementById('calls-list');

  const roomForm = document.getElementById('room-form');
  const roomPeriodFilter = document.getElementById('room-period-filter');
  const roomsList = document.getElementById('rooms-list');
  const roomCount = document.getElementById('room-count');
  const roomDetailPanel = document.getElementById('room-detail-panel');
  const roomsMainView = document.getElementById('rooms-main-view');
  const backToRoomsButton = document.getElementById('back-to-rooms');
  const detailRoomTitle = document.getElementById('detail-room-title');
  const detailRoomMeta = document.getElementById('detail-room-meta');
  const roomStudentsBody = document.querySelector('#room-students-table tbody');

  function formatPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '').replace(/^55/, '');
    return cleaned.length === 11 ? `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}` : phone;
  }

  function showToast(message, type = 'success', duration = 3200) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  function setButtonLoading(button, isLoading, text) {
    if (!button) return;
    if (isLoading) {
      button.dataset.originalText = button.textContent;
      button.textContent = text || 'Aguarde...';
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  async function fetchJSON(url, options = {}) {
    const response = await fetch(url, options);
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error || 'Erro de rede');
    }
    return json;
  }

  function navigate(page) {
    const validPages = ['attendance', 'students', 'rooms', 'calls'];
    if (!validPages.includes(page)) return;

    navItems.forEach(el => el.classList.toggle('active', el.dataset.page === page));
    pageSections.forEach(el => {
      const isActive = el.id === `page-${page}`;
      el.style.display = isActive ? 'block' : 'none';
      el.classList.toggle('active', isActive);
    });

    document.querySelector('.topbar-title').textContent =
      { attendance: '📋 Registro de Chamada', students: '👤 Alunos', rooms: '🏫 Salas', calls: '📞 Chamadas' }[page] || '';

    if (page === 'attendance') {
      loadAttendance();
    } else if (page === 'students') {
      fetchStudents();
    } else if (page === 'rooms') {
      loadRooms();
    }
  }

  navItems.forEach(el => el.addEventListener('click', (event) => {
    event.preventDefault();
    navigate(el.dataset.page);
  }));

  function updateClock() {
    const now = new Date();
    if (clockEl) clockEl.textContent = now.toLocaleString();
  }

  setInterval(updateClock, 1000);
  updateClock();

  async function loadRooms() {
    try {
      const rooms = await fetchJSON('/api/rooms');
      const filteredRooms = roomPeriodFilter.value ? rooms.filter(r => r.shift === roomPeriodFilter.value) : rooms;
      roomFilter.innerHTML = '<option value="">Todas as salas</option>' + rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
      attendanceRoomFilter.innerHTML = '<option value="">Todas</option>' + rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
      roomSelect.innerHTML = '<option value="">Nenhuma</option>' + rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
      roomCount.textContent = filteredRooms.length;
      roomsList.innerHTML = filteredRooms.length
        ? filteredRooms.map(r => `
          <li class="room-card room-card-clickable" data-room-id="${r.id}">
            <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
              <div>
                <strong>${r.name}</strong>
                ${r.year ? `<div style="font-size: 0.9rem; color: var(--muted);">Ano: ${r.year}</div>` : ''}
                ${r.series_name ? `<div style="font-size: 0.9rem; color: var(--muted);">Serie: ${r.series_name}</div>` : ''}
                ${r.shift ? `<div style="font-size: 0.9rem; color: var(--muted);">Turno: ${r.shift}</div>` : ''}
              </div>
              <button type="button" class="btn btn-danger btn-xs delete-room-btn" data-id="${r.id}">Excluir</button>
            </div>
          </li>
        `).join('')
        : '<li class="empty-state">Nenhuma sala cadastrada.</li>';
    } catch (error) {
      console.error(error);
      showToast('Falha ao carregar salas.', 'error');
    }
  }

  async function loadSeries() {
    try {
      const series = await fetchJSON('/api/series');
      seriesFilter.innerHTML = '<option value="">Todas as séries</option>' + series.map((item) => `<option value="${item}">${item}</option>`).join('');
    } catch (error) {
      console.error(error);
      showToast('Falha ao carregar séries.', 'error');
    }
  }

  async function showRoomDetails(roomId) {
    try {
      const rooms = await fetchJSON('/api/rooms');
      const room = rooms.find(r => String(r.id) === String(roomId));
      if (!room) return showToast('Sala não encontrada.', 'error');

      detailRoomTitle.textContent = room.name;
      const metaParts = [];
      if (room.year) metaParts.push(`Ano: ${room.year}`);
      if (room.series_name) metaParts.push(`Série: ${room.series_name}`);
      if (room.shift) metaParts.push(`Turno: ${room.shift}`);
      detailRoomMeta.textContent = metaParts.join(' • ');

      roomsMainView.classList.add('hidden');
      roomDetailPanel.classList.remove('hidden');

      const students = await fetchJSON(`/api/students?room_id=${roomId}`);
      roomStudentsBody.innerHTML = students.length
        ? students.map(s => `
          <tr>
            <td>${s.name}</td>
            <td>${s.ra}</td>
            <td>${s.room_name || '-'}</td>
            <td>${s.guardian_name}</td>
            <td>${formatPhone(s.guardian_phone)}</td>
          </tr>
        `).join('')
        : '<tr><td colspan="5" class="empty-state">Nenhum aluno cadastrado nesta sala.</td></tr>';
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar detalhes da sala.', 'error');
    }
  }

  async function fetchStudents() {
    try {
      const series = seriesFilter.value;
      const room = roomFilter.value;
      const params = new URLSearchParams();
      if (series) params.set('series', series);
      if (room) params.set('room_id', room);
      const students = await fetchJSON('/api/students?' + params.toString());

      studentsTableBody.innerHTML = students.length
        ? students.map(s => `
          <tr>
            <td>${s.name}</td>
            <td>${s.ra}</td>
            <td>${s.series}</td>
            <td>${s.room_name || '-'}</td>
            <td>${s.guardian_name}</td>
            <td>${formatPhone(s.guardian_phone)}</td>
            <td><button type="button" class="btn btn-danger btn-xs delete-student-btn" data-id="${s.id}">Excluir</button></td>
          </tr>
        `).join('')
        : '<tr><td colspan="7" class="empty-state">Nenhum aluno encontrado.</td></tr>';
    } catch (error) {
      console.error(error);
      showToast('Falha ao carregar alunos.', 'error');
      studentsTableBody.innerHTML = '<tr><td colspan="7" class="empty-state">Erro ao carregar alunos.</td></tr>';
    }
  }

  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      setButtonLoading(studentForm.querySelector('button[type="submit"]'), true, 'Salvando...');
      const data = {
        name: document.getElementById('name').value.trim(),
        ra: document.getElementById('ra').value.trim(),
        series: '',
        guardian_name: document.getElementById('guardian_name').value.trim(),
        guardian_phone: document.getElementById('guardian_phone').value.trim(),
        room_id: document.getElementById('room-select').value || null
      };
      await fetchJSON('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      studentForm.reset();
      addStudentPanel.classList.add('hidden');
      await fetchStudents();
      showToast('Aluno cadastrado com sucesso.');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Erro ao cadastrar aluno.', 'error');
    } finally {
      setButtonLoading(studentForm.querySelector('button[type="submit"]'), false);
    }
  });

  openAddStudent.addEventListener('click', () => addStudentPanel.classList.remove('hidden'));
  cancelAddStudent.addEventListener('click', () => addStudentPanel.classList.add('hidden'));
  refreshStudentsButton.addEventListener('click', async () => {
    setButtonLoading(refreshStudentsButton, true, 'Atualizando...');
    await fetchStudents();
    setButtonLoading(refreshStudentsButton, false);
  });
  roomFilter.addEventListener('change', fetchStudents);
  seriesFilter.addEventListener('change', fetchStudents);
  roomPeriodFilter.addEventListener('change', loadRooms);
  attendanceRoomFilter.addEventListener('change', loadAttendance);
  attendanceDateInput.addEventListener('change', loadAttendance);

  studentsTableBody.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('delete-student-btn')) return;
    const studentId = e.target.dataset.id;
    if (!studentId || !confirm('Deseja realmente excluir este aluno?')) return;

    try {
      setButtonLoading(e.target, true, 'Excluindo...');
      await fetchJSON(`/api/students/${studentId}`, { method: 'DELETE' });
      await fetchStudents();
      showToast('Aluno excluído com sucesso.', 'success');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Erro ao excluir aluno.', 'error');
    } finally {
      setButtonLoading(e.target, false);
    }
  });

  async function loadAttendance() {
    try {
      const date = attendanceDateInput.value || new Date().toISOString().slice(0,10);
      attendanceDateInput.value = date;
      const room = attendanceRoomFilter.value;
      const students = await fetchJSON('/api/students' + (room ? `?room_id=${room}` : ''));
      const existing = await fetchJSON('/api/attendance?date=' + date);
      const map = {};
      existing.forEach(a => { map[a.student_id] = a; });

      attendanceTableBody.innerHTML = students.length
        ? students.map(s => {
          const a = map[s.id];
          return `
            <tr>
              <td>${s.name}</td>
              <td>${s.ra}</td>
              <td>${s.series}</td>
              <td>${s.room_name || '-'}</td>
              <td>
                <select data-id="${s.id}" class="att-status">
                  <option value="present" ${a && a.status==='present' ? 'selected' : ''}>Presente</option>
                  <option value="absent" ${a && a.status==='absent' ? 'selected' : ''}>Faltou</option>
                  <option value="excused" ${a && a.status==='excused' ? 'selected' : ''}>Atestado</option>
                </select>
              </td>
              <td><input class="att-reason" data-id="${s.id}" value="${a && a.reason ? a.reason : ''}" /></td>
              <td><button type="button" class="notify-btn" data-student="${s.id}" data-att="${a ? a.id : ''}">Notificar</button></td>
            </tr>
          `;
        }).join('')
        : '<tr><td colspan="7" class="empty-state">Nenhum aluno disponível para chamada.</td></tr>';
      const hasStudents = students.length > 0;
      saveAllAttendanceButton.disabled = !hasStudents;
      attendanceActions.style.display = hasStudents ? 'flex' : 'none';
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar chamada.', 'error');
      attendanceTableBody.innerHTML = '<tr><td colspan="7" class="empty-state">Erro ao carregar chamada.</td></tr>';
      saveAllAttendanceButton.disabled = true;
    }
  }

  attendanceTableBody.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('notify-btn')) return;
    const button = e.target;
    try {
      setButtonLoading(button, true, 'Abrindo...');
      const studentId = button.dataset.student;
      const date = attendanceDateInput.value;
      const data = await fetchJSON(`/api/notify/${studentId}?date=${date}`);
      window.open(data.url, '_blank');
      if (data.attendanceId) {
        await fetchJSON(`/api/attendance/${data.attendanceId}/notify`, { method: 'POST' });
        button.textContent = 'Notificado';
      }
      showToast('Link gerado com sucesso.', 'success');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Não foi possível gerar link.', 'error');
    } finally {
      setButtonLoading(button, false);
    }
  });

  saveAllAttendanceButton.addEventListener('click', async () => {
    const date = attendanceDateInput.value;
    if (!date) return showToast('Selecione a data.', 'info');
    try {
      setButtonLoading(saveAllAttendanceButton, true, 'Salvando...');
      const rows = Array.from(attendanceTableBody.querySelectorAll('tr'));
      const entries = rows.map(row => {
        const status = row.querySelector('.att-status');
        const reason = row.querySelector('.att-reason');
        return { studentId: status.dataset.id, status: status.value, reason: reason.value };
      });
      await fetchJSON('/api/attendance/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, entries }) });
      await loadAttendance();
      showToast('Chamada salva com sucesso.');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Erro ao salvar chamada.', 'error');
    } finally {
      setButtonLoading(saveAllAttendanceButton, false);
    }
  });

  loadCallsButton.addEventListener('click', async () => {
    try {
      setButtonLoading(loadCallsButton, true, 'Carregando...');
      const date = callsDateInput.value || new Date().toISOString().slice(0,10);
      const data = await fetchJSON('/api/attendance?date=' + date);
      if (!data.length) {
        callsList.innerHTML = '<p class="empty-state">Sem chamadas</p>';
        showToast('Nenhuma chamada encontrada para a data.', 'info');
        return;
      }
      callsList.innerHTML = data.map(d => `<div class="call-item"><span>${d.date} — ${d.student_name} — ${d.series} — ${d.status}${d.reason ? ' — ' + d.reason : ''}</span><span>${d.notified ? 'Notificado' : 'Não notificado'}</span></div>`).join('');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Erro ao carregar chamadas.', 'error');
    } finally {
      setButtonLoading(loadCallsButton, false);
    }
  });

  roomForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const button = roomForm.querySelector('button[type="submit"]');
      setButtonLoading(button, true, 'Salvando...');
      const name = document.getElementById('room-name').value.trim();
      if (!name) return showToast('Informe o nome da sala.', 'info');
      const data = {
        name,
        year: document.getElementById('room-year').value.trim() || null,
        series_name: document.getElementById('room-series').value.trim() || null,
        shift: document.getElementById('room-shift').value || null
      };
      await fetchJSON('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      roomForm.reset();
      await loadRooms();
      showToast('Sala adicionada com sucesso.');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Erro ao criar sala.', 'error');
    } finally {
      setButtonLoading(roomForm.querySelector('button[type="submit"]'), false);
    }
  });

  roomsList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-room-btn')) {
      const roomId = e.target.dataset.id;
      if (!roomId || !confirm('Deseja realmente excluir esta sala?')) return;

      try {
        setButtonLoading(e.target, true, 'Excluindo...');
        await fetchJSON(`/api/rooms/${roomId}`, { method: 'DELETE' });
        await loadRooms();
        showToast('Sala excluída com sucesso.', 'success');
      } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao excluir sala.', 'error');
      } finally {
        setButtonLoading(e.target, false);
      }
      return;
    }

    const roomItem = e.target.closest('.room-card-clickable');
    if (roomItem) {
      const roomId = roomItem.dataset.roomId;
      await showRoomDetails(roomId);
    }
  });

  backToRoomsButton.addEventListener('click', () => {
    roomDetailPanel.classList.add('hidden');
    roomsMainView.classList.remove('hidden');
    loadRooms();
  });

  attendanceDateInput.value = new Date().toISOString().slice(0,10);
  callsDateInput.value = new Date().toISOString().slice(0,10);

  function init() {
    navigate('attendance');
    loadRooms();
    loadSeries();
    fetchStudents();
    loadAttendance();
  }

  init();
});
