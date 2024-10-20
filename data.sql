--ADMIN
INSERT INTO users (
    name,
    password,
    email,
    "emailVerifiedAt",
    image,
    role
)
VALUES (
    'Gabriel Duarte (Admin)',
    '$2a$10$9MNlYjGwtoiBcomHbwb/aO43d7EdY5As9Gll2XVYj1mSR7uIGdrvO',
    'gabrielwilliamson92@gmail.com',
    '2024-02-10 22:47:14.056',
    NULL,
    'ADMIN'
);

--DOCTORS
INSERT INTO
    users (
        name,
        password,
        email,
        "emailVerifiedAt",
        image,
        role
    )
VALUES (
        'Francisco Mejia Zamora',
        '$2a$10$9MNlYjGwtoiBcomHbwb/aO43d7EdY5As9Gll2XVYj1mSR7uIGdrvO',
        'doctor1@gmail.com',
        '2024-02-10 22:47:14.056',
        NULL,
        'DOCTOR'
    ),
    (
        'Felix Dormus',
        '$2a$10$9MNlYjGwtoiBcomHbwb/aO43d7EdY5As9Gll2XVYj1mSR7uIGdrvO',
        'doctor2@gmail.com',
        '2024-02-10 22:47:14.056',
        NULL,
        'DOCTOR'
    );

INSERT INTO
    doctors ("userId", specialtie)
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


--ASSISTANTS
INSERT INTO
    users (
        name,
        password,
        email,
        "emailVerifiedAt",
        image,
        role
    )
VALUES (
        'Migdalia Sanchez',
        '$2a$10$9MNlYjGwtoiBcomHbwb/aO43d7EdY5As9Gll2XVYj1mSR7uIGdrvO',
        'assistant1@gmail.com',
        '2024-02-10 22:47:14.056',
        NULL,
        'ASSISTANT'
    ),
    (
        'Sofia Sanchez',
        '$2a$10$9MNlYjGwtoiBcomHbwb/aO43d7EdY5As9Gll2XVYj1mSR7uIGdrvO',
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
