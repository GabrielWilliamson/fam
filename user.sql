--Insert admin in users table
INSERT INTO
    public."users" (
        "name",
        "password",
        "email",
        "emailVerifiedAt",
        "image",
        "role",
        "updatedAt"
    )
VALUES (
        'Admin',
        '$2b$10$7ZBKOOXU8jy4UaUt6SZUzuBoIaTpr/g/MNkZiKrdS61xbKLiqj6rO',
        'admin@gmail.com',
        '2024-02-10 22:47:14.056',
        NULL,
        'ADMIN',
        '2024-02-10 22:47:14.056'
    )
    -- Insert the first doctor and user
INSERT INTO
    public."users" (
        "name",
        "password",
        "email",
        "emailVerifiedAt",
        "image",
        "role",
        "updatedAt"
    )
VALUES (
        'Doctor 1',
        '$2b$10$7ZBKOOXU8jy4UaUt6SZUzuBoIaTpr/g/MNkZiKrdS61xbKLiqj6rO',
        'doctor1@gmail.com',
        '2024-02-10 22:47:14.056',
        NULL,
        'DOCTOR',
        '2024-02-10 22:47:14.056'
    ),
    (
        'Doctor 2',
        '$2b$10$7ZBKOOXU8jy4UaUt6SZUzuBoIaTpr/g/MNkZiKrdS61xbKLiqj6rO',
        'doctor2@gmail.com',
        '2024-02-10 22:47:14.056',
        NULL,
        'DOCTOR',
        '2024-02-10 22:47:14.056'
    ),
    (
        'Doctor 3',
        '$2b$10$7ZBKOOXU8jy4UaUt6SZUzuBoIaTpr/g/MNkZiKrdS61xbKLiqj6rO',
        'doctor3@gmail.com',
        '2024-02-10 22:47:14.056',
        NULL,
        'DOCTOR',
        '2024-02-10 22:47:14.056'
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
        'GENERAL'
    ),
    (
        (
            SELECT "id"
            FROM public."users"
            WHERE
                "email" = 'doctor2@gmail.com'
        ),
        'GENERAL'
    ),
    (
        (
            SELECT "id"
            FROM public."users"
            WHERE
                "email" = 'doctor3@gmail.com'
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
        "role",
        "updatedAt"
    )
VALUES (
        'Assistant 1',
        '$2b$10$7ZBKOOXU8jy4UaUt6SZUzuBoIaTpr/g/MNkZiKrdS61xbKLiqj6rO',
        'assistant1@gmail.com',
        '2024-02-10 22:47:14.056',
        NULL,
        'ASSISTANT',
        '2024-02-10 22:47:14.056'
    ),
    (
        'Assistant 2',
        '$2b$10$7ZBKOOXU8jy4UaUt6SZUzuBoIaTpr/g/MNkZiKrdS61xbKLiqj6rO',
        'assistant2@gmail.com',
        '2024-02-10 22:47:14.056',
        NULL,
        'ASSISTANT',
        '2024-02-10 22:47:14.056'
    ),
    (
        'Assistant 3',
        '$2b$10$7ZBKOOXU8jy4UaUt6SZUzuBoIaTpr/g/MNkZiKrdS61xbKLiqj6rO',
        'assistant3@gmail.com',
        '2024-02-10 22:47:14.056',
        NULL,
        'ASSISTANT',
        '2024-02-10 22:47:14.056'
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
    ),
    (
        (
            SELECT "id"
            FROM public."users"
            WHERE
                "email" = 'assistant3@gmail.com'
        )
    );