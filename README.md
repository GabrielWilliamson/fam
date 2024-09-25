# database backup
pg_dump -U postgres -h localhost -F c -b -v -f backup.dump famed


# database restore
pg_restore -U postgres -d famed --clean --no-owner /home/gabriel/Desktop/backup.dump

# gzip
gzip backup.dump

#clear database
psql -U $DB_USER -d $DB_NAME -c "
      DO \$\$
      DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
              EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
      END
      \$\$; "










      .get("/file", async (c) => {
        const user = c.get("user");
        if (!user) return c.json({ success: false, data: null }, 401);
        if (user.role != "DOCTOR")
          return c.json({ success: false, data: null }, 401);

        const doctorId = await doctorIdentification(user.id, user.role);
        if (doctorId === null) {
          return c.json({ success: false, data: null }, 500);
        }

        const patientId = c.req.query("patientId");
        if (!patientId) return c.json({ success: false, data: null }, 500);

        const dataName = await db
          .select({
            doctorName: Users.name,
          })
          .from(Patients)
          .innerJoin(Doctors, eq(Patients.doctorId, Doctors.id))
          .innerJoin(Users, eq(Users.id, Doctors.userId))
          .where(eq(Patients.id, patientId));

        if (dataName.length <= 0) {
          return c.json({ success: false, data: null }, 500);
        }

        const relatives = await db
          .select({
            id: Relatives.id,
            name: Relatives.name,
            dni: Relatives.dni,
            phone: Relatives.phone,
            relation: Relatives.relation,
            civilStatus: Relatives.civilStatus,
          })
          .from(Relatives)
          .where(eq(Relatives.patientId, patientId));

        const my = await db
          .select({
            infecto: Files.infecto,
            hereditary: Files.hereditary,
            image: Patients.image,
            app: Files.app,
            apnp: Files.apnp,
          })
          .from(Files)
          .innerJoin(Patients, eq(Files.patientId, Patients.id))
          .where(eq(Files.patientId, patientId));

        const file = my[0];
        if (file.image) {
          const image = await getResource(file.image);
          file.image = image;
        }

        const name = dataName[0].doctorName;

        return c.json({ success: true, data: { file, relatives, name } });
      })
