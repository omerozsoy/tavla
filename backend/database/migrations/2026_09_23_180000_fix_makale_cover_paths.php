<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('contents')
            ->where('type', 'makale')
            ->where('image', 'like', '/makale-covers/%')
            ->update([
                'image' => DB::raw("REPLACE(image, '/makale-covers/', '/uploads/makale/')"),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('contents')
            ->where('type', 'makale')
            ->where('image', 'like', '/uploads/makale/%')
            ->update([
                'image' => DB::raw("REPLACE(image, '/uploads/makale/', '/makale-covers/')"),
                'updated_at' => now(),
            ]);
    }
};
