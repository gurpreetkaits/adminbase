<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

class CreateUser extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'user:create
                            {--name= : The name of the user}
                            {--email= : The email address of the user}
                            {--password= : The password for the user}
                            {--verified : Mark the email as verified}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a new user';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $name = $this->option('name') ?? text(
            label: 'What is the user\'s name?',
            placeholder: 'John Doe',
            required: true,
        );

        $email = $this->option('email') ?? text(
            label: 'What is the user\'s email address?',
            placeholder: 'john@example.com',
            required: true,
            validate: fn (string $value) => match (true) {
                ! filter_var($value, FILTER_VALIDATE_EMAIL) => 'The email address must be valid.',
                User::query()->where('email', $value)->exists() => 'A user with this email already exists.',
                default => null
            }
        );

        $passwordInput = $this->option('password') ?? password(
            label: 'What is the user\'s password?',
            placeholder: 'password',
            required: true,
            validate: fn (string $value) => match (true) {
                strlen($value) < 8 => 'The password must be at least 8 characters.',
                default => null
            }
        );

        $user = User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($passwordInput),
            'email_verified_at' => $this->option('verified') ? now() : null,
        ]);

        $this->components->info('User created successfully!');
        $this->newLine();
        $this->components->twoColumnDetail('Name', $user->name);
        $this->components->twoColumnDetail('Email', $user->email);
        $this->components->twoColumnDetail('Email Verified', $user->email_verified_at ? 'Yes' : 'No');

        return Command::SUCCESS;
    }
}
