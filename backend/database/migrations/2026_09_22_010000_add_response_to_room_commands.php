<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('room_commands') || Schema::hasColumn('room_commands', 'response_json')) {
            return;
        }

        Schema::table('room_commands', function (Blueprint $table) {
            $table->text('response_json')->nullable()->after('result_version');
            $table->unsignedSmallInteger('response_status')->nullable()->after('response_json');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('room_commands') || ! Schema::hasColumn('room_commands', 'response_json')) {
            return;
        }

        Schema::table('room_commands', function (Blueprint $table) {
            $table->dropColumn(['response_json', 'response_status']);
        });
    }
};
