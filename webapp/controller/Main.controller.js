sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, JSONModel, Filter, FilterOperator) {
        "use strict";

        return Controller.extend("zuinp00010.controller.Main", {
            onInit: function () {

                var oViewModel = new JSONModel({
                    busy: true,
                    delay: 0,
                    traineeGroup: "2",
                    dateTime: new Date(),
                    Operation: "",
                    PreviousDay: false,
                    GeolocationGranted: false,
                    Geolocation: "",
                    DialogButtonsEnabled: false,
                    EnableRegistrationButton: true,
                    ElegibleForRegistration: true,
                    EmployeeGroup: "",
                    TeamView: "tab"
                    //IP:""
                });

                var oMessageManager = sap.ui.getCore().getMessageManager();
                this.getView().setModel(oMessageManager.getMessageModel(), "message");
                oMessageManager.registerObject(this.getView(), true);

                this.getView().setModel(oViewModel, "mainView");
                this.getOwnerComponent().getRouter().getRoute("RouteMain").attachPatternMatched(this._onRouteMatched, this);

                this.getView().attachAfterRendering(this._filterAppointments, this);                
            },

            onRegister: function(oEvent){
                var oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                var oViewModel   = this.getView().getModel("mainView");
                let sOperation   = oViewModel.getProperty("/Operation");
                let sGeoLocGrant = oViewModel.getProperty("/GeolocationGranted");
                let sTraineeGroup = oViewModel.getProperty("/traineeGroup");
                let sEmployeeGroup = oViewModel.getProperty("/EmployeeGroup");

                if(sEmployeeGroup !== sTraineeGroup && sOperation == ""){
                    sap.m.MessageBox.error(oResourceBundle.getText("errorOperation"));
                    return;
                }

                oViewModel.setProperty("/EnableRegistrationButton", false);

                if(sGeoLocGrant){
                    navigator.geolocation.getCurrentPosition(this._geolocationSuccess.bind(this),this._geolocationError.bind(this))
                }
                else{
                    this._checkRegister();
                }
            }, //onRegister

            onChangeTeamView: function(oEvent){

                this.getView().getModel("mainView").setProperty("/TeamView", oEvent.getParameter("item").getKey());
                
            }, //onChangeTeamView

            _geolocationSuccess: function(position){
                this.getView().getModel("mainView").setProperty("/Geolocation", position.coords.latitude + ";" + position.coords.longitude);
                this._checkRegister();
            }, //geolocationSuccess

            _geolocationError: function(){
                var oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                sap.m.MessageBox.error(oResourceBundle.getText("geolocationDenied"));
                
                this.getView().getModel("mainView").setProperty("/EnableRegistrationButton", true);
                
            }, //geolocationError

            _checkRegister: function(){
                //Verifica ultimo apontamento do dia antes de registrar
                this._getDayAppointments();
            }, //_checkRegister

            _getDayAppointments: function(){
                var oModel = this.getOwnerComponent().getModel("time");
                var that   = this

                var oFilter = new Filter({ path: 'Date',
                                           operator: FilterOperator.EQ,
                                           value1: new Date() });

                oModel.metadataLoaded().then( function() {
                    oModel.read("/AppointmentSet",{
                        filters: [oFilter],
                        success: that._fnDayAppointSuccess.bind(that)
                    });
                });

            }, //_getDayAppointments

            _fnDayAppointSuccess: function(oData){
                var oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                var oViewModel   = this.getView().getModel("mainView");
                var sOperation   = oViewModel.getProperty("/Operation");
                var that         = this;
                var bInvalid     = false;
                var sMessage     = '';

                if(oData.results.length !== 0){                    
                    //ordena por hora
                    oData.results.sort((a,b) => (a.Time > b.Time) ? 1 : ((b.Time > a.Time) ? -1 : 0));
                    //recupera ultima batida
                    var oLastAppointment = oData.results[oData.results.length - 1];
                    //verifica se esta repetindo
                    if( sOperation === oLastAppointment.AppointmentType ){
                        switch (sOperation) {
                            case 'P10':
                                bInvalid = true;
                                sMessage = oResourceBundle.getText("confirmRepeatEntry");
                                break;                        
                            case 'P20':
                                bInvalid = true;
                                sMessage = oResourceBundle.getText("confirmRepeatExit");
                                break;
                            default:
                                break;
                        }
                    } // Operation equal
                } //results length

                if (bInvalid) {
                    //confirmar se deseja repetir o apontamento
                    sap.m.MessageBox.confirm(sMessage,{
                        actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                        onClose: function (sAction) {
                            if(sAction == "YES"){
                                that._register();
                            }
                            else{
                               oViewModel.setProperty("/EnableRegistrationButton", true);
                            }
                        }
                    });
                } else{
                    this._register();
                }

            }, //_fnDayAppointSuccess

            _register: function(){
                var oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                var oModel       = this.getView().getModel("time");
                var oViewModel   = this.getView().getModel("mainView");
                var oObject      = this.getView().getBindingContext().getObject();
                var oDevice      = this.getOwnerComponent().getModel("device").getData();
                var deviceSerial = "";

                let sOperation   = oViewModel.getProperty("/Operation");
                let oDateTime    = oViewModel.getProperty("/dateTime");
                let sGeoLocGrant = oViewModel.getProperty("/GeolocationGranted");
                let sGeoLocation = oViewModel.getProperty("/Geolocation");
                let sPreviousDay = oViewModel.getProperty("/PreviousDay");

                var formatTimestamp = sap.ui.core.format.DateFormat.getDateInstance({
                    pattern : "yyyyMMddHHmmss"
                });

                if (window.device) {
                    deviceSerial = window.device.serial;
                }

                var oEntry = oModel.createEntry("RegistrationPointSet", {
                    properties: {
                        EmployeeId: oObject.Pernr,
                        Timestamp: formatTimestamp.format(oDateTime),
                        Operation: sOperation,
                        Process: "EXEC",
                        PreviousDay: sPreviousDay,
                        GeolocationGranted: sGeoLocGrant,
                        Geolocation: sGeoLocation,
                        IP: "", //*Sera lido no SAP*
                        TerminalId: oDevice.system.phone? "MOBI" : "PORT"
                    }
                });

                var oObjectReg = oEntry.getObject();
                delete oObjectReg.__metadata;

                oViewModel.setProperty("/busy", true);
                sap.ui.getCore().getMessageManager().removeAllMessages();

                oModel.create("/RegistrationPointSet", oObjectReg, {
                    success: this._fnSaveSuccess.bind(this),
                    error: this._fnRequestFailed.bind(this)
                });

            }, //_register

            _fnSaveSuccess: function(oData){
                var oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                var oViewModel = this.getView().getModel("mainView");
                var oModel       = this.getView().getModel("time");

                oViewModel.setProperty("/busy", false);
                oViewModel.setProperty("/EnableRegistrationButton", true);
                oModel.refresh();

                sap.m.MessageBox.success(oResourceBundle.getText("saveSuccess"));
            }, //_fnSaveSuccess

            _fnRequestFailed: function(oData){
                var oViewModel = this.getView().getModel("mainView");

                oViewModel.setProperty("/busy", false);
                oViewModel.setProperty("/EnableRegistrationButton", true);
            }, //_fnRequestFailed

            formatPhoto: function(photo){
                var oReturn =  "data:image/jpeg;base64," + photo
                //var oReturn = "https://10.129.195.6:8001/sap/opu/odata/sap/Y_KBS_CADASTRO_APP_SRV;o=ECC_GW_HCM/ANEXOS(GuidAnexo=guid'005056b2-04f5-1edf-8bcc-5cda54798b48',Processo='FT_CCOLAB')/$value"
                
                return oReturn;
            },

            _onRouteMatched: function(oEvent){

                var oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                var oModel      = this.getView().getModel();
                var oModelTime  = this.getView().getModel("time");
                var oViewModel  = this.getView().getModel("mainView");
                var that        = this;

                oModel.metadataLoaded().then( function() {                    
                    
                    oModel.setUseBatch(false);

                    //Employee Data
                    var sObjectPath = oModel.createKey("/EmployeeDataSet", { Pernr: "$" });

                    this.getView().bindElement({
                        path: sObjectPath,
                        parameters: {
                        },
                        events: {
                            dataRequested: function (oEvent) {
                                oViewModel.setProperty("/busy", true);
                            },
                            dataReceived: function (oData) {
                                oViewModel.setProperty("/busy", false);

                            }
                        }
                    });    
                    
                    setInterval(this._updateDateTime.bind(this), 1000);

                }.bind(this));   

                oModelTime.metadataLoaded().then( function() {  
                    var sPath = oModelTime.createKey("/EmployeeDataSet", { EmployeeId: "$" });

                    oModelTime.read(sPath,{
                        success: this._fnSuccessTime.bind(this)
                    });
                }.bind(this));   
                
                //this._criaCarousel();

            }, //_onRouteMatched

            _updateDateTime: function(){
                this.getView().getModel("mainView").setProperty("/dateTime", new Date())
            }, //_updateDateTime

            _fnSuccessTime: function(oData){
                var oViewModel   = this.getView().getModel("mainView");

                this._setVisibilityTime(oData);
                this._setGeolocationAuth(oData);

                if(!oData.ElegibleForRegistration){
                    oViewModel.setProperty("/ElegibleForRegistration", false);
                    this.getView().byId("registerTitle").destroy();
                    this.getView().byId("registerBlock").destroy();
                }
                oViewModel.setProperty("/EmployeeGroup", oData.EmployeeGroup);
                
            }, // _fnSuccessTime

            _setVisibilityTime: function(oData){
                var oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();  
                //var oAppointTable   = this.getView().byId("smartTableAppointments");              
                var oViewModel      = this.getView().getModel("mainView");
                let sTraineeGroup   = oViewModel.getProperty("/traineeGroup");

                if(oData.EmployeeGroup === sTraineeGroup){
                    //Ocultar coluna de hora
                    //oAppointTable.deactivateColumns(["Time"]);
                }
                
            }, // _setVisibilityTime

            _setGeolocationAuth: function(oData){
                var oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                var oViewModel  = this.getView().getModel("mainView");
                var that = this

                if(oData.ElegibleForGeolocation){
                    if(oData.GeolocationRequested){
                        oViewModel.setProperty("/GeolocationGranted",oData.GeolocationGranted);
                    }
                    else{ //se nao foi socilitado ainda, verificar
                        sap.m.MessageBox.confirm(oResourceBundle.getText("confirmGeolocationAccess"),{
                            actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                            onClose: function (sAction) {
                                if(sAction == "YES"){
                                    oViewModel.setProperty("/GeolocationGranted",true);
                                }
                                else{
                                    oViewModel.setProperty("/GeolocationGranted",false);
                                }
                                that._saveGeolocationGranted();
                            }
                        });
                    }
                }
            }, // _setGeolocationAuth

            _saveGeolocationGranted: function(){
                var oModel       = this.getView().getModel("time");
                var oViewModel   = this.getView().getModel("mainView");
                var oObject      = this.getView().getBindingContext().getObject();
                let sGeoLocGrant = oViewModel.getProperty("/GeolocationGranted");

                var sObjectPath = oModel.createKey("/EmployeeDataSet", { EmployeeId: oObject.Pernr });

                var oObjectUpd = {
                    EmployeeId: oObject.Pernr,
                    GeolocationGranted: sGeoLocGrant
                }

                sap.ui.getCore().getMessageManager().removeAllMessages();
                oModel.setUseBatch(false);

                oModel.update(sObjectPath, oObjectUpd);
            }, //_saveGeolocationGranted

            _getDatasImportantes: function () {
                var oModel = this.getOwnerComponent().getModel();
                var that = this

                oModel.metadataLoaded().then(function () {
                    oModel.read("/ImportantDatesSet", {
                        success: that._fnDatasImportantesSuccess.bind(that)
                    });
                });

            }, //_getDatasImportantes

            _fnDatasImportantesSuccess: function (oData) {
                var oDatasImportantes = new JSONModel(oData.results);
                this.getView().setModel(oDatasImportantes, "DatasImportantesModel");
            }, //_fnDatasImportantesSuccess

            _filterAppointments: function(){
                var oTable = this.byId("tabAppoint");

                if(!oTable) return;

                var oBinding = oTable.getBinding("items");
                var oFilter = new Filter({ path: 'Date',
                                           operator: FilterOperator.EQ,
                                           value1: new Date() });

                oBinding.filter([oFilter]);
            },//_filterAppointments

            _setVisibilityCarousel: function(oEvent){
                var oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                var aData = oEvent.getParameter("data").results;

                if(aData.length == 0){
                    this.getView().byId("titBoxFiqueLigado").setText("");
                    this.getView().byId("vBoxFiqueLigado").setVisible(false);
                }
                else{
                    this.getView().byId("titBoxFiqueLigado").setText(oResourceBundle.getText("lblDataComemorativa"));
                    this.getView().byId("vBoxFiqueLigado").setVisible(true);
                }
            },//_setVisibilityCarousel

            showEmployeeDetail: function(oEvent){
                var oButton = oEvent.getSource();
                var oContext = oButton.getParent().getBindingContext();

                if (!this._oQuickView) {
                    sap.ui.core.Fragment.load({
                        name: "zuinp00010.view.EmployeeDetail",
                        type: "XML"
                    }).then(function(oFragment) {
                        this._oQuickView = oFragment;
                        this.getView().addDependent(this._oQuickView);

                    }.bind(this));
                }
                
                setTimeout(function () {
                    this._oQuickView.setBindingContext(oContext);
                    this._oQuickView.openBy(oButton);
                }.bind(this), 0);

            },//showEmployeeDetail

            suggestOrg: function(oEvent){
                var oGraph = oEvent.getSource();
				var aItems = oGraph.getNodes();
                var sTerm  = oEvent.getParameter("term");                
                var aSuggestionItems = [], aFilteredItems = [];

                sTerm = sTerm ? sTerm : "";

                aFilteredItems = aItems.filter(function (oItem) {
                    var sTitle = oItem.getDescription() ? oItem.getDescription() : "";
                    return sTitle.toLowerCase().indexOf(sTerm.toLowerCase()) !== -1;
                });

                aFilteredItems.sort(function (oItem1, oItem2) {
                    var sTitle = oItem1.getDescription() ? oItem1.getDescription() : "";
                    return sTitle.localeCompare(oItem2.getDescription());
                }).forEach(function (oItem) {
                    aSuggestionItems.push(new sap.m.SuggestionItem({
                        key: oItem.getId(),
                        text: oItem.getDescription()
                    }));
                });

                oGraph.setSearchSuggestionItems(aSuggestionItems);
                oEvent.bPreventDefault = true;

            }, //suggestOrg

            searchOrg: function(oEvent){
                var oGraph = oEvent.getSource();
                var sKey = oEvent.getParameter("key");

                var aItems = oGraph.getNodes();
                aItems.forEach((node)=>{

                    if(sKey && node.getId() === sKey){
                        node.setSelected(true);
                    }
                    else{
                        node.setSelected(false);
                    }
                })

            }, //searchOrg

            orgLinePress: function(oEvent){
                oEvent.bPreventDefault = true;
            }, //orgLinePress

            onMessagePopoverPress: function(oEvent){
                if(!this._pMessagePopover){
                    this._pMessagePopover = sap.ui.xmlfragment("zuinp00010.view.Messages",this);
                    this.getView().addDependent(this._pMessagePopover);
                }
                this._pMessagePopover.openBy(oEvent.getSource());
            } //onMessagePopoverPress

        });
    });
