<?php

namespace App\Forms\Components;

use Filament\Forms\Components\Field;

/**
 * Tarayıcının/OS'un NATIVE renk seçicisi (<input type="color"> — gradient + damlalık)
 * yanında serbest hex kutusu. Değer "#RRGGBB" olarak saklanır (Filament ColorPicker ile
 * aynı veri yolu). Filament'in kendi ColorPicker'ı yetersiz bulundu -> native seçici.
 */
class NativeColor extends Field
{
    protected string $view = 'filament.forms.native-color';
}
