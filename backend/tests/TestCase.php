<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // SiteGate'i test ortaminda KESIN kapali tut. SiteGate request aninda
        // config('app.site_password') okur; ortamda/CI'de SITE_PASSWORD sizarsa ya da
        // prod config cache gelirse tum /api testleri 401 {gate:true} alirdi. phpunit.xml
        // <env>, Laravel'in immutable env() deposunu ambient getenv()'e karsi EZEMEDIGINDEN
        // tek guvenli nokta config'i dogrudan burada bosaltmaktir.
        config(['app.site_password' => '']);
    }
}
