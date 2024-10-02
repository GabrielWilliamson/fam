 entrar a
 psqlpsql -U fameduser -d famed


 listar las tablas
 \dt



# database backup

pg_dump -U postgres -h localhost -F c -b -v -f backup.dump famed

# ver que si esta corriendo

sudo systemctl status famed.service

# database restore

pg_restore -U postgres -d famed --clean --no-owner /home/gabriel/Desktop/backup.dump

# gzip

gzip backup.dump

#clear database
psql -U fameduser -d famed -c "
DO \$\$
DECLARE
r RECORD;
BEGIN
FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
END LOOP;
END
\$\$; "

# para instalar lo necesario para el runner

sudo ./svc.sh install

# para ponerlo a ejecutar en segundo plano

sudo ./svc.sh start

# Entrar al directorio de configuracion del servicio en segundo plano

sudo nano /etc/systemd/system/famed.service

# ver el .env

/home/ubuntu/.bun/bin/bun

sudo nano /etc/famed.env

# restringir permisos

sudo chmod 600 /etc/famed.env
sudo chown ubuntu:ubuntu /etc/famed.env

# si se realizan cambios en etc

    sudo systemctl daemon-reload
    sudo systemctl enable famed.service
    sudo systemctl start famed.service

# reiniciar el servicio

# si se realizan cambios en la app

    sudo systemctl restart famed.service
