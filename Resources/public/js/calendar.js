/*
 * This file is part of the Claroline Connect package.
 *
 * (c) Claroline Consortium <consortium@claroline.net>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

(function () {
    'use strict';

    window.Claroline = window.Claroline || {};
    var calendar = window.Claroline.Calendar = {};
    var canEditEvent;
    var addUrl;
    var showUrl;
    var $calendarElement = $('#calendar');
    var isFormShown = false;

    calendar.initialize = function (
        context,
        workspaceId,
        canEdit
    ) {
        context = context || 'desktop';
        workspaceId = workspaceId || null;
        //the creation is enabled by default
        if (canEdit === undefined) {
            canEditEvent = true;
        } else {
            canEditEvent = JSON.parse(canEdit);
        }

        // Initialize route & url depending on the context
        if (context !== 'desktop') {
            addUrl = Routing.generate('claro_workspace_agenda_add_event_form', {'workspace': workspaceId});
            showUrl = Routing.generate('claro_workspace_agenda_show', {'workspace': workspaceId});
        } else {
            addUrl = Routing.generate('claro_desktop_agenda_add_event_form');
            showUrl = Routing.generate('claro_desktop_agenda_show');
        }

        // Initialize the click event on the import button
        onImport();
        // Initialize the click event on the document
        onBodyClick();

        $('.filter,.filter-tasks').click(function () {
            filterEvents(getWorkspaceFilterChecked());
        });

        // INITIALIZE CALENDAR
        $calendarElement.fullCalendar({
            header: {
                left: 'prev,next, today',
                center: 'title',
                right: 'month,agendaWeek,agendaDay'
            },
            columnFormat: {
                month: 'ddd',
                week: 'ddd D/M',
                day: 'dddd D/M'
            },
            buttonText: {
                prev: t('prev'),
                next: t('next'),
                prevYear: t('prevYear'),
                nextYear: t('nextYear'),
                today: t('today'),
                month: t('month_'),
                week: t('week'),
                day: t('day_')
            },
            firstDay: 1,
            monthNames: t(['month.january', 'month.february', 'month.march', 'month.april', 'month.may', 'month.june', 'month.july', 'month.august', 'month.september', 'month.october', 'month.november', 'month.december']),
            monthNamesShort: t(['month.jan', 'month.feb', 'month.mar', 'month.apr', 'month.may', 'month.ju', 'month.jul', 'month.aug', 'month.sept',  'month.oct', 'month.nov', 'month.dec']),
            dayNames: t(['day.sunday', 'day.monday', 'day.tuesday', 'day.wednesday', 'day.thursday', 'day.friday', 'day.saturday']),
            dayNamesShort: t(['day.sun', 'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat']),
            //This is the url wich will get the events from ajax the 1st time the calendar is launched
            events: showUrl,
            axisFormat: 'HH:mm',
            timeFormat: 'H:mm',
            agenda: 'h:mm{ - h:mm}',
            allDayText: t('isAllDay'),
            lazyFetching : false,
            fixedWeekCount: false,
            eventLimit: 4,
            timezone: 'local',
            eventDrop: onEventDrop,
            dayClick: renderAddEventForm,
            eventClick:  onEventClick,
            eventDestroy: onEventDestroy,
            eventMouseover: onEventMouseover,
            eventMouseout: onEventMouseout,
            eventRender: onEventRender,
            eventResize: onEventResize
        });

        // If a year is define in the Url, redirect the calendar to that year, month and day
        redirectCalendar();
    };

    function onEventDrop(event, delta, revertFunc, jsEvent, ui, view)
    {
        resizeOrMove(event, delta._days, delta._milliseconds / (1000 * 60), 'move');
    }

     function onEventClick(event, jsEvent)
     {
         var workspaceId = event.workspace_id ? event.workspace_id : 0;
         if (canEditEvent[workspaceId]) {
             // If the user can edit the event
             var $this = $(this);
             // If click on the check symbol of a task, mark this task as "to do"
             if ($(jsEvent.target).hasClass('fa-check')) {
                 markTaskAsToDo(event, jsEvent, $this);
             }
             // If click on the checkbox of a task, mark this task as done
             else if ($(jsEvent.target).hasClass('fa-square-o')) {
                 markTaskAsDone(event, jsEvent, $this);
             }
             // Show the modal form
             else {
                 showEditForm(event);
             }
         }
    }

    function onEventDestroy(event, $element)
    {
        $element.popover('destroy');
    }

    function onEventMouseover()
    {
       $(this).popover('show');
    }

    function onEventMouseout()
    {
        $(this).popover('hide');
    }

    function onEventRender(event, element)
    {
        if (event.visible === undefined) {
            filterEvent(event, getWorkspaceFilterChecked());
        }

        if (!event.visible) {
            return false;
        }

        renderEvent(event, element);
    }

    function onEventResize(event, delta, revertFunc, jsEvent, ui, view)
    {
        resizeOrMove(event, delta._days, delta._milliseconds / (1000 * 60), 'resize');
    }

    function renderEvent(event, $element)
    {
        // Create the popover for the event or the task
        createPopover(event, $element);
        var workspaceId = event.workspace_id ? event.workspace_id : 0;
        event.editable = canEditEvent[workspaceId];
        if (event.editable) {
            $element.addClass('fc-draggable');
        }

        // If it's a task
        if (event.isTask) {
            var eventContent =  $element.find('.fc-content');
            // Remove the date
            eventContent.find('.fc-time').remove();
            $element.css({
                'background-color': 'rgb(144, 32, 32)',
                'border-color': 'rgb(144, 32, 32)'
            });
            eventContent.prepend('<span class="task fa" data-event-id="' + event.id + '"></span>');

            // Add the checkbox if the task is not done or the check symbol if the task is done
            var checkbox = eventContent.find('.task');
            if (event.isTaskDone) {
                checkbox.addClass('fa-check');
                checkbox.next().css('text-decoration', 'line-through');
            } else {
                checkbox.addClass('fa-square-o');
            }
        }
    }

    function renderAddEventForm(date)
    {
        // Select the first id of the json canEditEvent
        for(var key in canEditEvent) break;
        if (canEditEvent[key] && !isFormShown) {
            var dateVal = moment(date).format(t('date_agenda_display_format'));

            var postRenderAddEventAction = function (html) {
                $('#agenda_form_start').val(dateVal);
                $('#agenda_form_end').val(dateVal);
            };

            window.Claroline.Modal.displayForm(
                addUrl,
                addItemsToCalendar,
                postRenderAddEventAction,
                'form-event'
            );

            isFormShown = true;
        }
    }

    $('body').on('hide.bs.modal', '.modal', function (event) {
        isFormShown = false;
    });

    function addEventAndTaskToCalendar(event)
    {
        $calendarElement.fullCalendar('renderEvent', event);
    }

    function addItemsToCalendar(events)
    {
        for (var i = 0; i < events.length; i++) {
            addEventAndTaskToCalendar(events[i]);
        }
    }

    function updateCalendarItem(event)
    {
        removeEvent(undefined, undefined, event);
        addItemsToCalendar(new Array(event));
    }

    function updateCalendarItemCallback(event)
    {
        updateCalendarItem(event);
    }

    function removeEvent(event, item, data)
    {
        $calendarElement.fullCalendar('removeEvents', data.id);
    }

    function resizeOrMove(event, dayDelta, minuteDelta, action)
    {
        var route = action === 'move' ? 'claro_workspace_agenda_move': 'claro_workspace_agenda_resize';
        $.ajax({
            url: Routing.generate(route, {'event': event.id, 'day': dayDelta, 'minute': minuteDelta}),
            type: 'POST',
            success: function (event) {
                // Update the event to change the popover's data
                updateCalendarItem(event);
            }
        });
    }

    function filterEvent(event, workspaceIds)
    {
        var numberOfChecked = $('.filter:checkbox:checked').length;
        var totalCheckboxes = $('.filter:checkbox').length;
        var radioValue = $('input[type=radio].filter-tasks:checked').val();
        // If all checkboxes or none checkboxes are checked display all events
        if (((totalCheckboxes - numberOfChecked === 0) || (numberOfChecked === 0)) && radioValue === 'no-filter-tasks') {
            event.visible = true;
        } else {
            var workspaceId = event.workspace_id === null ? 0 : event.workspace_id;

            if (radioValue === 'no-filter-tasks') {
                event.visible = $.inArray(workspaceId, workspaceIds) >= 0;
            }
            // Hide all the tasks
            else if (radioValue === 'hide-tasks') {
                event.visible = !event.isTask;

                if (!event.isTask) {
                    event.visible = $.inArray(workspaceId, workspaceIds) >= 0 || workspaceIds.length === 0;
                }
            }
            // Hide all the events
            else {
                event.visible = event.isTask;

                if (event.isTask) {
                    event.visible = $.inArray(workspaceId, workspaceIds) >= 0 || workspaceIds.length === 0;
                }
            }
        }
    }

    function filterEvents(workspaceIds)
    {
        $calendarElement.fullCalendar('clientEvents', function (eventObject) {
            filterEvent(eventObject, workspaceIds);
        });

        $calendarElement.fullCalendar('rerenderEvents');
    }

    function createPopover(event, $element)
    {
        // In FullCalendar 2.3.1, the end date is null when the start date is the same
        if (event.end === null) {
            event.end = event.start;
        }
        convertDateTimeToString();
        $element.popover({
            title: event.title,
            content: Twig.render(EventContent, {'event': event}),
            html: true,
            container: 'body',
            placement: 'top'
        });
    }

    function convertDateTimeToString()
    {
        Twig.setFilter('convertDateTimeToString', function (value, isAllDay, isEndDate) {
            isEndDate = typeof isEndDate !== 'undefined' ? isEndDate : false;
            if (isAllDay) {
                // We have to subtract 1 day for the all day events because it ends on the next day at midnight. So for a better user's experience, we subtract 1 day for the end date.
                if (isEndDate) {
                    return moment(value).subtract(1, 'day').format('DD/MM/YYYY');
                } else {
                    return moment(value).format('DD/MM/YYYY');
                }
            } else {
                return moment(value).format('DD/MM/YYYY HH:mm');
            }
        });
    }

    function markTaskAsToDo(event, jsEvent, $element)
    {
        $.ajax({
            url: window.Routing.generate('claro_agenda_set_task_as_not_done', {'event': event.id}),
            type: 'GET',
            success: function() {
                $(jsEvent.target)
                    .removeClass('fa-check')
                    .addClass('fa-square-o')
                    .next().css('text-decoration', 'none');
                $element.popover('destroy');
                event.isTaskDone = false;
                createPopover(event, $element);
            }
        })
    }

    function markTaskAsDone(event, jsEvent, $element)
    {
        $.ajax({
            url: window.Routing.generate('claro_agenda_set_task_as_done', {'event': event.id}),
            type: 'GET',
            success: function() {
                $(jsEvent.target)
                    .removeClass('fa-square-o')
                    .addClass('fa-check')
                    .next().css('text-decoration', 'line-through');
                $element.popover('destroy');
                event.isTaskDone = true;
                createPopover(event, $element);
            }
        })
    }

    function showEditForm(event)
    {
        if (!isFormShown) {
            window.Claroline.Modal.displayForm(
                Routing.generate('claro_agenda_update_event_form', {'event': event.id}),
                updateCalendarItemCallback,
                function () {
                    $('#agenda_form_isTask').is(':checked') ? hideStartDate() : showStartDate();
                    $('#agenda_form_isAllDay').is(':checked') ? hideFormhours(): showFormhours();
                },
                'form-event'
            );

            isFormShown = true;
        }
    }

    function hideFormhours()
    {
        $('#agenda_form_endHours').parent().parent().hide();
        $('#agenda_form_startHours').parent().parent().hide();
    }

    function showFormhours()
    {
        $('#agenda_form_endHours').parent().parent().show();
        if (!$('#agenda_form_isTask').is(':checked')) {
            $('#agenda_form_startHours').parent().parent().show();
        }
    }

    function hideStartDate()
    {
        $('#agenda_form_start').parent().parent().hide();
        $('#agenda_form_startHours').parent().parent().hide();
    }

    function showStartDate()
    {
        $('#agenda_form_start').parent().parent().show();
        if (!$('#agenda_form_isAllDay').is(':checked')) {
            $('#agenda_form_startHours').parent().parent().show();
        }
    }

    function getQueryVariable(variable)
    {
        var query = window.location.search.substring(1);
        var vars = query.split("&");

        for (var i = 0, varsLength = vars.length; i < varsLength; i++) {
            var pair = vars[i].split("=");
            if(decodeURIComponent(pair[0]) == variable){
                return decodeURIComponent(pair[1]);
            }
        }
        return null;
    }

    function redirectCalendar()
    {
        if (getQueryVariable('year')) {
            var year = !isNaN(getQueryVariable('year')) && getQueryVariable('year') ? getQueryVariable('year') : new Date('Y'),
                month = !isNaN(getQueryVariable('month')) && getQueryVariable('month') ? getQueryVariable('month') : new Date('m'),
                day = !isNaN(getQueryVariable('day')) && getQueryVariable('day') ? getQueryVariable('day') : new Date('d');

            $calendarElement.fullCalendar('gotoDate', year + '-' + month + '-' + day);
        }
    }

    function getWorkspaceFilterChecked()
    {
        var workspaceIds = [];

        $('.filter:checkbox:checked').each(function () {
            workspaceIds.push(parseInt($(this).val()));
        });

        return workspaceIds;
    }

    function t(key) {
        if (typeof key === 'object') {
            var transWords = [];
            for (var i = 0; i < key.length; i++) {
                transWords.push(Translator.trans(key[i], {}, 'agenda'));
            }
            return transWords;
        }
        return Translator.trans(key, {}, 'agenda');
    }

    function onBodyClick()
    {
        $('body')
            // Delete the event from the form and the popover button
            .on('click', '.delete-event', function (event) {
                event.preventDefault();
                window.Claroline.Modal.confirmRequest(
                    $(event.currentTarget).attr('href'),
                    removeEvent,
                    undefined,
                    t('remove_event_confirm'),
                    t('remove_event')
                );
            })
            // Hide the hours if the checkbox allDay is checked
            .on('click', '#agenda_form_isAllDay', function() {
                $('#agenda_form_isAllDay').is(':checked') ? hideFormhours(): showFormhours();
            })
            // Hide the start date if the task is checked.
            .on('click', '#agenda_form_isTask', function() {
                $('#agenda_form_isTask').is(':checked') ? hideStartDate() : showStartDate();
            })
        ;
    }

    function onImport()
    {
        $('#import-ics-btn').on('click', function (event) {
            event.preventDefault();
            window.Claroline.Modal.displayForm(
                $(event.target).attr('href'),
                addItemsToCalendar,
                function () {},
                'ics-import-form'
            );
        });
    }
}) ();