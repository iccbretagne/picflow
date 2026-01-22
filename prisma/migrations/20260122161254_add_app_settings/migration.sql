-- CreateTable
CREATE TABLE `AppSettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `logoKey` VARCHAR(512) NULL,
    `faviconKey` VARCHAR(512) NULL,
    `logoFilename` VARCHAR(255) NULL,
    `faviconFilename` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
