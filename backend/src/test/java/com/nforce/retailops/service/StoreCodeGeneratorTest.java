package com.nforce.retailops.service;

import com.nforce.retailops.entity.StoreCodeCounter;
import com.nforce.retailops.repository.StoreCodeCounterRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StoreCodeGeneratorTest {

    @Mock
    private StoreCodeCounterRepository storeCodeCounterRepository;

    @Test
    void startsAtTenThousandOneWhenTheCounterRowDoesNotExistYet() {
        when(storeCodeCounterRepository.lockTheCounter()).thenReturn(Optional.empty());
        when(storeCodeCounterRepository.save(any(StoreCodeCounter.class))).thenAnswer(invocation -> invocation.getArgument(0));

        long code = new StoreCodeGenerator(storeCodeCounterRepository).next();

        assertThat(code).isEqualTo(10001L);

        ArgumentCaptor<StoreCodeCounter> savedCounters = ArgumentCaptor.forClass(StoreCodeCounter.class);
        verify(storeCodeCounterRepository, org.mockito.Mockito.times(2)).save(savedCounters.capture());
        // First save creates the row at 10001, second save advances it past the code just handed out.
        assertThat(savedCounters.getAllValues().get(1).getNextValue()).isEqualTo(10002L);
    }

    @Test
    void incrementsByOneEachCallWhenTheCounterRowAlreadyExists() {
        StoreCodeCounter counter = new StoreCodeCounter();
        counter.setId(1);
        counter.setNextValue(10007L);
        when(storeCodeCounterRepository.lockTheCounter()).thenReturn(Optional.of(counter));
        when(storeCodeCounterRepository.save(any(StoreCodeCounter.class))).thenAnswer(invocation -> invocation.getArgument(0));

        long code = new StoreCodeGenerator(storeCodeCounterRepository).next();

        assertThat(code).isEqualTo(10007L);
        assertThat(counter.getNextValue()).isEqualTo(10008L);
    }
}
