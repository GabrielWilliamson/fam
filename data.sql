-- Active: 1723649901072@@127.0.0.1@5432@famed@public
--Insert admin in users table
INSERT INTO
    public."users" (
        "name",
        "password",
        "email",
        "emailVerifiedAt",
        "image",
        "role"
    )
VALUES (
        'Gabriel Duarte (Admin)',
        '$2b$10$7ZBKOOXU8jy4UaUt6SZUzuBoIaTpr/g/MNkZiKrdS61xbKLiqj6rO',
        'gabrielwilliamson92@gmail.com',
        '2024-02-10 22:47:14.056',
        NULL,
        'ADMIN'
    )
    -- Insert the first doctor and user

INSERT INTO
    public."users" (
        "name",
        "password",
        "email",
        "emailVerifiedAt",
        "image",
        "role"
    )
VALUES (
        'Francisco Mejia Zamora',
        '$2b$10$7ZBKOOXU8jy4UaUt6SZUzuBoIaTpr/g/MNkZiKrdS61xbKLiqj6rO',
        'doctor1@gmail.com',
        '2024-02-10 22:47:14.056',
        NULL,
        'DOCTOR'
    ),
    (
        'Felix Dormus',
        '$2b$10$7ZBKOOXU8jy4UaUt6SZUzuBoIaTpr/g/MNkZiKrdS61xbKLiqj6rO',
        'doctor2@gmail.com',
        '2024-02-10 22:47:14.056',
        NULL,
        'DOCTOR'
    );

-- Insert into the doctors table using the userId fetched by the email
INSERT INTO
    doctors ("userId", "specialtie")
VALUES (
        (
            SELECT "id"
            FROM public."users"
            WHERE
                "email" = 'doctor1@gmail.com'
        ),
        'PEDIATRIA'
    ),
    (
        (
            SELECT "id"
            FROM public."users"
            WHERE
                "email" = 'doctor2@gmail.com'
        ),
        'GENERAL'
    );

--Insert Assistant in users table
INSERT INTO
    public."users" (
        "name",
        "password",
        "email",
        "emailVerifiedAt",
        "image",
        "role"

    )
VALUES (
        'Migdalia Sanchez',
        '$2b$10$7ZBKOOXU8jy4UaUt6SZUzuBoIaTpr/g/MNkZiKrdS61xbKLiqj6rO',
        'assistant1@gmail.com',
        '2024-02-10 22:47:14.056',
        NULL,
        'ASSISTANT'
    ),
    (
        'Sofia Sanchez',
        '$2b$10$7ZBKOOXU8jy4UaUt6SZUzuBoIaTpr/g/MNkZiKrdS61xbKLiqj6rO',
        'assistant2@gmail.com',
        '2024-02-10 22:47:14.056',
        NULL,
        'ASSISTANT'
    );

INSERT INTO
    assistants ("userId")
VALUES (
        (
            SELECT "id"
            FROM public."users"
            WHERE
                "email" = 'assistant1@gmail.com'
        )
    ),
    (
        (
            SELECT "id"
            FROM public."users"
            WHERE
                "email" = 'assistant2@gmail.com'
        )
    );


    -- add banks
    insert into
      banks (name)
    values
      ('BAC'),
      ('BAMPRO'),
      ('LAFISE Bancentro'),
      ('Ficohsa'),
      ('Avanz')
