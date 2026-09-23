-- =============================================================================
-- IMPORT DATA PESERTA DIDIK — Pendataan Peserta Didik Bhakti Academy (Responses).xlsx
-- Baris sumber: 121; setelah filter future-date + dedupe nama+bday + merge (bday+hp): 80
-- Mapping: nama->Nama Lengkap | jenis_kelamin->Jenis Kelamin (Perempuan->Putri,
-- Laki-laki->Putra) | tanggal_lahir->Tanggal Lahir | nama_ortu->Nama Orang Tua / Wali
-- | hp_ortu->No. HP Orang Tua/Wali (normalisasi 08/8 -> 62..) | tanggal_daftar->now()
-- | status->Aktif | id 'SIS-'+8 hex (setara next_sequence_id di app) | barcode BSA-####.
-- WAJIB: tabel siswa KOSONG (lain tidak, ada INSERT arriba). yak jalankan di SQL Editor.
-- =============================================================================

begin;

insert into siswa (id, barcode, nama, jenis_kelamin, tanggal_lahir, nama_ortu, hp_ortu, tanggal_daftar, status) values
  ('SIS-d7ebcd23', 'BSA-0001', 'Abdul Majid', 'Putra', '2015-06-28', 'Rusmiati (Ibu)', '6285162706684', now(), 'Aktif'),
  ('SIS-5d167514', 'BSA-0002', 'Adelia Putri Oktaviani', 'Putri', '2012-10-22', 'Yulianti (Ibu), Iwan Toro (Ayah)', '6283831456516', now(), 'Aktif'),
  ('SIS-b9f5e546', 'BSA-0003', 'Aditya Saputra', 'Putra', '2013-03-22', 'Sahrudin (Ayah)', '6281249906047', now(), 'Aktif'),
  ('SIS-80e9aa2c', 'BSA-0004', 'Ahmad As''ad', 'Putra', '2012-09-20', 'Elisnawati (Ibu)', '6282353159143', now(), 'Aktif'),
  ('SIS-8786b037', 'BSA-0005', 'Ahmad Naufal Nandara', 'Putra', '2012-05-06', 'Any Ansyari (Ibu)', '6285386430003', now(), 'Aktif'),
  ('SIS-d3f18973', 'BSA-0006', 'Alifa Rizqiya Husna', 'Putri', '2013-09-24', 'Sri Husnah', '6285932404518', now(), 'Aktif'),
  ('SIS-14086d7c', 'BSA-0007', 'Alisha Rania Azzahra', 'Putri', '2015-09-15', 'Hafizah', '6282155944497', now(), 'Aktif'),
  ('SIS-de832f80', 'BSA-0008', 'Almira Zuhda Muttaqin', 'Putri', '2016-08-04', 'Irma Rosanti (Ibu)', '6289601725287', now(), 'Aktif'),
  ('SIS-0de3f886', 'BSA-0009', 'Alya Razwa Afifah', 'Putri', '2011-08-07', 'Nafsiah', '6281545419242', now(), 'Aktif'),
  ('SIS-d51021f9', 'BSA-0010', 'Amelia Jasmin', 'Putri', '2013-10-02', 'Jamatul Rezekiah (Ibu), Eko Rismanto (Ayah)', '6283141126255', now(), 'Aktif'),
  ('SIS-fcdd5c8d', 'BSA-0011', 'Andri Raharja Salim', 'Putra', '2014-11-26', 'Faridah (Ibu)', '6281311337579', now(), 'Aktif'),
  ('SIS-34b9562a', 'BSA-0012', 'Annida Zahratunnisa', 'Putri', '2014-02-23', 'Norjenah', '6281351545381', now(), 'Aktif'),
  ('SIS-def12c42', 'BSA-0013', 'Antung Mirza Pratama', 'Putra', '2014-04-11', 'Nurul Qamariah (Ibu)', '6285161198866', now(), 'Aktif'),
  ('SIS-fe4294c8', 'BSA-0014', 'Aqilla Annida Putri', 'Putri', '2014-11-19', 'Fitri Ira Hariyatie', '6281246628012', now(), 'Aktif'),
  ('SIS-337e687f', 'BSA-0015', 'Assyifa Nur Hafizah', 'Putri', '2013-04-04', 'Heriyadi (Ayah)', '6281348797336', now(), 'Aktif'),
  ('SIS-496e63ff', 'BSA-0016', 'Asyla Rubi Wardana', 'Putri', '2013-10-02', 'Kusrianti', '6281349305333', now(), 'Aktif'),
  ('SIS-78bf7062', 'BSA-0017', 'Azra Noor Huda', 'Putri', '2015-03-15', 'Novia Indriani (Ibu)', '6281573808158', now(), 'Aktif'),
  ('SIS-81912d19', 'BSA-0018', 'Brandon Christian Lim', 'Putra', '2014-11-27', 'Asiong (Ayah)', '6281251511316', now(), 'Aktif'),
  ('SIS-d7368819', 'BSA-0019', 'Cantiqa Nur Ramadhani', 'Putri', '2014-07-22', 'Santi Puji Astuti', '6285705383676', now(), 'Aktif'),
  ('SIS-b3bb9540', 'BSA-0020', 'Cinta Elshafira', 'Putri', '2016-05-22', 'Dayat', '6283159806224', now(), 'Aktif'),
  ('SIS-688d1c11', 'BSA-0021', 'Clara Hotmaria Situmorang', 'Putri', '2015-04-13', 'Pestaria Simanihuruk (Ibu)', '6282152715847', now(), 'Aktif'),
  ('SIS-251a18bd', 'BSA-0022', 'Darul Mari’fah', 'Putri', '2014-05-21', 'Mariatul Kiftiah', '6285750518299', now(), 'Aktif'),
  ('SIS-1ec72291', 'BSA-0023', 'Demiko Anugerah Kayana', 'Putra', '2016-02-18', 'Devie Yuliana (Ibu)', '6285349990662', now(), 'Aktif'),
  ('SIS-23dd77c6', 'BSA-0024', 'Dewi Marsya', 'Putri', '2016-10-22', 'Marlina', '6282352501057', now(), 'Aktif'),
  ('SIS-a21e555d', 'BSA-0025', 'Elshareefa Jehan Ma''mun', 'Putri', '2014-03-22', 'Muhammad Syukron Ma''mun', '628115009971', now(), 'Aktif'),
  ('SIS-95e934a0', 'BSA-0026', 'Falisha Abdilla', 'Putri', '2015-07-30', 'Isnawati (Ibu)', '6281348804088', now(), 'Aktif'),
  ('SIS-54eede36', 'BSA-0027', 'Fathimah Nazila R', 'Putri', '2016-02-16', 'Syahriansyah (Ayah)', '6281903466984', now(), 'Aktif'),
  ('SIS-f5cc95c2', 'BSA-0028', 'Filcya Angelin', 'Putri', '2013-03-23', 'Thonga (Ibu)', '6281246095222', now(), 'Aktif'),
  ('SIS-ece63251', 'BSA-0029', 'Gerardo Sutanto', 'Putra', '2015-06-12', 'Veronica (Ibu)', '6281232332400', now(), 'Aktif'),
  ('SIS-ea377ba7', 'BSA-0030', 'Gracherin Alicia Lie', 'Putri', '2014-12-05', 'Fery Wijaya Lie (Ayah)', '628125009208', now(), 'Aktif'),
  ('SIS-b41e9512', 'BSA-0031', 'Gregorius Credo Canendra Haryanto', 'Putra', '2018-01-09', 'Galih Puji Haryanto (Ayah)', '6285654786061', now(), 'Aktif'),
  ('SIS-8671960a', 'BSA-0032', 'Halwah Qanita Fairuz', 'Putri', '2018-09-12', 'Febriyani', '6281258153848', now(), 'Aktif'),
  ('SIS-6d3c11f6', 'BSA-0033', 'Hasna Yasira', 'Putri', '2014-12-11', 'Erni Veranita', '6285821956208', now(), 'Aktif'),
  ('SIS-4bd78714', 'BSA-0034', 'Hauzan Irhab Nabil', 'Putra', '2013-06-02', 'Noor Fitri', '6287884340647', now(), 'Aktif'),
  ('SIS-2affd3a4', 'BSA-0035', 'Jeslyn Felicia', 'Putri', '2015-03-19', 'Thonga (Ibu)', '6281246095222', now(), 'Aktif'),
  ('SIS-d7ff920a', 'BSA-0036', 'Jihan Maulida Azkia', 'Putri', '2013-01-28', 'Bambang Karnadi (Ayah)', '6282298602267', now(), 'Aktif'),
  ('SIS-2d3e34f2', 'BSA-0037', 'Kenzio Arrayyan Saputra', 'Putra', '2018-04-09', 'Satria Arya Saputra (Ayah)', '628115110403', now(), 'Aktif'),
  ('SIS-84df3e84', 'BSA-0038', 'Khansa Ghaniya Nadda', 'Putri', '2017-07-13', 'Nurul Hikmah', '6285390536577', now(), 'Aktif'),
  ('SIS-e187af92', 'BSA-0039', 'Khodijah', 'Putri', '2014-09-02', 'Nurul Hidayanti', '6287819078184', now(), 'Aktif'),
  ('SIS-0e983035', 'BSA-0040', 'Khrisna Ramadhan', 'Putra', '2019-05-15', 'Cecep Ade Kuswara (Ayah)', '6281253047070', now(), 'Aktif'),
  ('SIS-9e280a3c', 'BSA-0041', 'Levi Ferensia', 'Putri', '2014-01-24', 'Yuyun (Ibu)', '6288223429964', now(), 'Aktif'),
  ('SIS-beb7e08c', 'BSA-0042', 'Madeline Joy Sutanto', 'Putri', '2016-07-03', 'Veronica', '6281232332400', now(), 'Aktif'),
  ('SIS-d9d9297a', 'BSA-0043', 'Madina Rayhida', 'Putri', '2012-12-04', 'Marsipah (Ibu)', '6282217037215', now(), 'Aktif'),
  ('SIS-780db136', 'BSA-0044', 'Marilyn Joy Sutanto', 'Putri', '2018-03-09', 'Veronica', '6281232332400', now(), 'Aktif'),
  ('SIS-51598855', 'BSA-0045', 'Marwa Aqila Rahmadani', 'Putri', '2012-08-15', 'Akhmad Syaifullah A.Md', '6281348448933', now(), 'Aktif'),
  ('SIS-e46349af', 'BSA-0046', 'Miguel Celio', 'Putra', '2015-08-10', 'Julie (Ibu)', '6282152721440', now(), 'Aktif'),
  ('SIS-83c1af12', 'BSA-0047', 'Muhammad Abizard Satria', 'Putra', '2019-02-13', 'Rusdiana (Ibu)', '6281345881319', now(), 'Aktif'),
  ('SIS-0c3910d4', 'BSA-0048', 'Muhammad Adam Al Fatih', 'Putra', '2014-11-24', 'Nirwan (Ayah)', '6281345299088', now(), 'Aktif'),
  ('SIS-4be605c7', 'BSA-0049', 'Muhammad Alfa Rizqi', 'Putra', '2017-06-27', 'Nirwan (Ayah)', '6281345299088', now(), 'Aktif'),
  ('SIS-28a683f3', 'BSA-0050', 'Muhammad Ankha Arkhananta', 'Putra', '2015-11-27', 'Rekha Fuji Lestari (Ibu)', '6282168086119', now(), 'Aktif'),
  ('SIS-caf30f54', 'BSA-0051', 'Muhammad Arvan Alrisar', 'Putra', '2019-12-02', 'Henny Rahmiati (Ibu)', '6281251697931', now(), 'Aktif'),
  ('SIS-9c81777b', 'BSA-0052', 'Muhammad Azhar Alrisam', 'Putra', '2016-06-24', 'Henny Rahmiati (Ibu)', '6281351697931', now(), 'Aktif'),
  ('SIS-a2cb0f0c', 'BSA-0053', 'Muhammad Azka Azzamy Bahri', 'Putra', '2015-06-12', 'Harlini (Ibu)', '6282213610151', now(), 'Aktif'),
  ('SIS-a16b13cb', 'BSA-0054', 'Muhammad Dicky Alfareza', 'Putra', '2016-07-15', 'Indri Masadiah (Ibu)', '6285248005093', now(), 'Aktif'),
  ('SIS-dcb4ded3', 'BSA-0055', 'Muhammad Fatan Fauji', 'Putra', '2016-07-29', 'Vera Herdina (Ibu)', '6282255491732', now(), 'Aktif'),
  ('SIS-b83c06a7', 'BSA-0056', 'Muhammad Gilang Pratama', 'Putra', '2012-08-22', 'Laras Indriati Purnama (Ibu)', '628125383316', now(), 'Aktif'),
  ('SIS-86fa9d2e', 'BSA-0057', 'Muhammad Hanif Hammam', 'Putra', '2014-07-08', 'Leli Jumiati (Ibu)', '6285216227595', now(), 'Aktif'),
  ('SIS-9980ae07', 'BSA-0058', 'Muhammad Ibnu Mubarok', 'Putra', '2015-04-13', 'Cecep Ade Kuswara (Ayah)', '6281253047070', now(), 'Aktif'),
  ('SIS-41c76de8', 'BSA-0059', 'Muhammad Khalid Alkahfi', 'Putra', '2019-06-12', 'Sri Wahyuningsih (Ibu)', '6285248401336', now(), 'Aktif'),
  ('SIS-5f81e2ce', 'BSA-0060', 'Muhammad Reyhan Al Qhalish', 'Putra', '2017-08-08', 'Sri Purnama (Ibu)', '6285348457355', now(), 'Aktif'),
  ('SIS-10973e85', 'BSA-0061', 'Mutiara Cinta Salsabiila', 'Putri', '2012-12-27', 'Mutia Faridah', '6285345846882', now(), 'Aktif'),
  ('SIS-af55baba', 'BSA-0062', 'Nahwa Ramadhani', 'Putri', '2012-07-26', 'Indah Silawati (Ibu)', '6282254946426', now(), 'Aktif'),
  ('SIS-2f57ccff', 'BSA-0063', 'Naufal Muhammad Albayhaqi', 'Putra', '2014-07-29', 'Rositawati (Ibu)', '6282153269983', now(), 'Aktif'),
  ('SIS-b734fa3d', 'BSA-0064', 'Niswatul Haya', 'Putri', '2013-06-29', 'Rusmayanti (Ibu)', '6285757288136', now(), 'Aktif'),
  ('SIS-f8ae189f', 'BSA-0065', 'Noor Amanda', 'Putri', '2016-03-19', 'Ilda Maudizah Julianda', '6282250680536', now(), 'Aktif'),
  ('SIS-3a7ceba1', 'BSA-0066', 'Nurmaliarahmah', 'Putri', '2017-01-27', 'Hj.Herlina', '62885225831441', now(), 'Aktif'),
  ('SIS-e4e59cfc', 'BSA-0067', 'Putri Aisyah Humaira', 'Putri', '2014-04-29', 'Ida Rusanti', '6282153575932', now(), 'Aktif'),
  ('SIS-4ba7cce5', 'BSA-0068', 'Quinn Nabila Somaya', 'Putri', '2015-09-19', 'Febriyani (Ibu)', '6281258153848', now(), 'Aktif'),
  ('SIS-0647d2da', 'BSA-0069', 'Raffasya Deffin El Fathian', 'Putra', '2019-08-08', 'Riza Umami (Ibu)', '6282149083731', now(), 'Aktif'),
  ('SIS-dc92d0ea', 'BSA-0070', 'Raisa Azzahra', 'Putri', '2013-08-11', 'Yuni Fitriani (Ibu)', '6282154230262', now(), 'Aktif'),
  ('SIS-6e28c342', 'BSA-0071', 'Raisya Arsyila Khaira', 'Putri', '2016-03-08', 'Laela (Ibu)', '6283867435203', now(), 'Aktif'),
  ('SIS-0026aff3', 'BSA-0072', 'Rayya Starla Adzkadina', 'Putri', '2017-05-28', 'Rabiatul Adawiyah (Ibu)', '6281254592125', now(), 'Aktif'),
  ('SIS-8890fa95', 'BSA-0073', 'Rizki Aufar Oktavian', 'Putra', '2014-10-22', 'Sulastri (Ibu)', '6282155944441', now(), 'Aktif'),
  ('SIS-951645e7', 'BSA-0074', 'Salam Nur Khaliq Saputra', 'Putra', '2017-03-17', 'Dewa Adi Saputra (Ayah)', '6285822282769', now(), 'Aktif'),
  ('SIS-17ee228e', 'BSA-0075', 'Siti Habibah', 'Putri', '2014-09-29', 'Iwaran', '628125052708', now(), 'Aktif'),
  ('SIS-0f991deb', 'BSA-0076', 'Suci Nurhani', 'Putri', '2014-02-20', 'Fadilah (Ibu)', '6281348376462', now(), 'Aktif'),
  ('SIS-ba17a86a', 'BSA-0077', 'Syarifah Azkia Zein', 'Putri', '2014-05-21', 'Rusmiwati (Ibu)', '6285248666253', now(), 'Aktif'),
  ('SIS-3a9aa047', 'BSA-0078', 'Syarifah Shidqiya', 'Putri', '2017-11-23', 'Efa Susanti (Ibu)', '6282154453724', now(), 'Aktif'),
  ('SIS-52345b08', 'BSA-0079', 'Syathira Adreena Zennaira', 'Putri', '2017-11-30', 'Rusdiana', '6281345881319', now(), 'Aktif'),
  ('SIS-13bcd9b1', 'BSA-0080', 'Wulan Jamilah Zarqa', 'Putri', '2015-02-02', 'Arliyana', '6282147888555', now(), 'Aktif')
;

-- Barcode berikutnya melanjutkan dari nomor terbesar (BSA-XXXX).
select sync_barcode_seq();

commit;
