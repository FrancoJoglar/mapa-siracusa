-- Migración: Agregar columna fc_manual a sectores
-- Permite al usuario administrador ingresar manualmente la fracción de cobertura
-- Si es NULL, se calcula automáticamente basado en la edad del cultivo

ALTER TABLE sectores ADD COLUMN fc_manual NUMERIC(3,2) DEFAULT NULL;
COMMENT ON COLUMN sectores.fc_manual IS 'Fracción de cobertura manual (0-1). NULL = cálculo automático por edad.';
