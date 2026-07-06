USE siga_escola;

INSERT INTO rooms (name) VALUES ('1A'), ('2B');

INSERT INTO students (name, ra, series, guardian_name, guardian_phone, room_id) VALUES
('Lucas Silva', '20240001', '1A', 'Maria Silva', '5598999123456', 1),
('Ana Pereira', '20240002', '1A', 'João Pereira', '5598999234567', 1),
('Pedro Souza', '20240003', '2B', 'Carla Souza', '5598999345678', 2);
