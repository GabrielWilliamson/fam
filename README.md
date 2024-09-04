- Puede dictar una prescripcion y una referecia al mismo tiempo

- Considera util el envio de la prescripcion en formato de imagen a los padres

- El consentimiento informado en que momento se realiza y que apartado conviene ubicar la opcion de generar este   documento por cuestion de accesibilidad, se le da una copia al paciente?,
  considera util guardar los consentimientos en el expediente del paciente de manera digital

- La asistente puede ver o agregar la foto de perfil del paciente

- La asistente podria modificar el tipo de cambio


<AnimatePresence>
                {showBillCounter && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold mb-2">Córdobas</h3>
                        <div className="grid grid-cols-4 gap-2">
                          {Object.entries(form.getValues().cordobas).map(
                            ([denomination]) => (
                              <FormField
                                key={`cordoba-${denomination}`}
                                control={form.control}
                                name={`cordobas.${denomination}.cant`}
                                render={({ field }) => (
                                  <FormItem>
                                    <div className="flex items-center">
                                      <CordobaICon className="mr-2 h-4 w-4 text-blue-600" />
                                      <FormLabel className="w-16">{`C$${denomination}`}</FormLabel>
                                      <FormControl>
                                        <Input
                                          type={"number"}
                                          onChange={(e) =>
                                            field.onChange(
                                              e.target.valueAsNumber
                                            )
                                          }
                                          min={0}
                                          max={100}
                                          className="w-20"
                                        />
                                      </FormControl>
                                    </div>
                                  </FormItem>
                                )}
                              />
                            )
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">Dólares</h3>
                        <div className="grid grid-cols-4 gap-2">
                          {Object.entries(form.getValues().dolars).map(
                            ([denomination]) => (
                              <FormField
                                key={`dolar-${denomination}`}
                                control={form.control}
                                name={`dolars.${denomination}.cant`}
                                render={({ field }) => (
                                  <FormItem>
                                    <div className="flex items-center">
                                      <DollarSign className="mr-2 h-4 w-4 text-blue-600" />
                                      <FormLabel className="w-16">{`$${denomination}`}</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          step="1"
                                          onChange={(e) => {
                                            const value =
                                              parseInt(e.target.value) || 0;
                                            field.onChange(value);
                                          }}
                                          min={0}
                                          className="w-20"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </div>
                                  </FormItem>
                                )}
                              />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>